import { useState, useEffect } from 'react';
import { Download, BarChart3, Filter } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { getSalaryCalculations, getEmployees } from '../services/db.js';
import { exportReportCSV } from '../services/exports.js';
import { formatCurrency, DEPT_COLORS, summarizePayroll } from '../utils/salaryCalc.js';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-medium)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? formatCurrency(p.value, true) : p.value}
        </div>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [calcs, setCalcs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (!user) return;
    Promise.all([getSalaryCalculations(user.uid), getEmployees(user.uid)])
      .then(([cs, emps]) => { setCalcs(cs); setEmployees(emps); })
      .catch(err => toast.error('Load failed', err.message))
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = calcs.filter(c => {
    const matchDept = !filterDept || c.department === filterDept;
    const matchFrom = !dateFrom || (c.createdAt || '') >= dateFrom;
    const matchTo   = !dateTo   || (c.createdAt || '') <= dateTo + 'T23:59:59';
    return matchDept && matchFrom && matchTo;
  });

  // Monthly trend (12 months)
  const now = new Date();
  const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
    const monthCalcs = filtered.filter(c => c.createdAt?.startsWith(key));
    const { totalGross: gross, totalNet: net, totalDed } = summarizePayroll(monthCalcs);
    return { month: label, gross, net, deductions: totalDed, count: monthCalcs.length };
  });

  // Department distribution
  const deptMap = {};
  filtered.forEach(c => {
    const dept = c.department || 'Other';
    if (!deptMap[dept]) deptMap[dept] = { name: dept, gross: 0, net: 0, count: 0 };
    deptMap[dept].gross += c.grossSalary || 0;
    deptMap[dept].net   += c.netSalary   || 0;
    deptMap[dept].count += 1;
  });
  const deptData = Object.values(deptMap).sort((a, b) => b.gross - a.gross);

  // Deduction breakdown
  const deductionTotals = filtered.reduce((acc, c) => ({
    'Provident Fund':  acc['Provident Fund']  + (c.providentFund   || 0),
    'Professional Tax':acc['Professional Tax'] + (c.professionalTax || 0),
    'Income Tax':      acc['Income Tax']       + (c.incomeTax       || 0),
    'Other':           acc['Other']            + (c.otherDeductions || 0),
  }), { 'Provident Fund': 0, 'Professional Tax': 0, 'Income Tax': 0, 'Other': 0 });

  const deductionPieData = Object.entries(deductionTotals)
    .filter(([,v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  // Employee salary distribution (bins)
  const { totalGross, totalNet, totalDed, count } = summarizePayroll(filtered);

  const allDepts = [...new Set(calcs.map(c => c.department).filter(Boolean))];

  function exportMonthly() {
    exportReportCSV(
      'Monthly Payroll Trend',
      ['Month', 'Gross', 'Net', 'Deductions', 'Calculations'],
      monthlyTrend.map(r => [r.month, r.gross, r.net, r.deductions, r.count])
    );
    toast.success('Exported', 'Monthly trend CSV downloaded.');
  }

  function exportDept() {
    exportReportCSV(
      'Department Payroll Distribution',
      ['Department', 'Total Gross', 'Total Net', 'Count'],
      deptData.map(r => [r.name, r.gross, r.net, r.count])
    );
    toast.success('Exported', 'Department report CSV downloaded.');
  }

  const hasData = filtered.length > 0;

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Payroll insights across {employees.length} employees · {count} calculations</p>
        </div>
      </div>

      {/* Filters */}
      <div className="toolbar" style={{ marginBottom: 24 }}>
        <select
          className="form-select"
          style={{ width: 180 }}
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          id="report-filter-dept"
        >
          <option value="">All Departments</option>
          {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <input type="date" className="form-input" style={{ width: 160 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} id="report-from" />
        <input type="date" className="form-input" style={{ width: 160 }} value={dateTo} onChange={e => setDateTo(e.target.value)} id="report-to" />
        {(filterDept || dateFrom || dateTo) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilterDept(''); setDateFrom(''); setDateTo(''); }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Summary stats */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Gross', value: formatCurrency(totalGross, true), sub: `${count} records`, color: 'var(--accent-lime)' },
          { label: 'Total Net', value: formatCurrency(totalNet, true), sub: `${totalGross > 0 ? ((totalNet/totalGross)*100).toFixed(1) : 0}% of gross`, color: 'var(--accent-green)' },
          { label: 'Total Deductions', value: formatCurrency(totalDed, true), sub: `${totalGross > 0 ? ((totalDed/totalGross)*100).toFixed(1) : 0}% of gross`, color: 'var(--accent-red)' },
          { label: 'Departments', value: deptData.length, sub: 'with payroll data', color: 'var(--accent-lavender)' },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-card-label">{s.label}</div>
            <div className="stat-card-value" style={{ color: s.color, fontSize: 22 }}>{s.value}</div>
            <div className="stat-card-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Monthly Trend */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Monthly Payroll Trend (12 months)</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Gross, Net, and Deductions over time</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={exportMonthly} id="export-monthly-btn">
            <Download size={13} /> Export
          </button>
        </div>
        {!hasData ? (
          <div className="empty-state"><div className="empty-state-icon"><BarChart3 size={24} /></div><div className="empty-state-title">No data yet</div></div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, bottom: 0, left: 20 }}>
              <defs>
                <linearGradient id="rGross" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c8f135" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#c8f135" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="rNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4ade80" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="rDed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f87171" stopOpacity={0.12}/>
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', paddingTop: 8 }} />
              <Area type="monotone" dataKey="gross" name="Gross" stroke="#c8f135" strokeWidth={2} fill="url(#rGross)" />
              <Area type="monotone" dataKey="net"   name="Net"   stroke="#4ade80" strokeWidth={2} fill="url(#rNet)" />
              <Area type="monotone" dataKey="deductions" name="Deductions" stroke="#f87171" strokeWidth={1.5} fill="url(#rDed)" strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Dept + Deduction row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Department Distribution */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Department Payroll</div>
            <button className="btn btn-secondary btn-sm" onClick={exportDept} id="export-dept-btn">
              <Download size={13} /> Export
            </button>
          </div>
          {deptData.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 0' }}><div className="empty-state-icon"><BarChart3 size={22} /></div><div className="empty-state-title">No data</div></div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={deptData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="gross" name="Gross" fill="#c8f135" radius={[0,3,3,0]} opacity={0.85} />
                <Bar dataKey="net"   name="Net"   fill="#4ade80" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Deduction Breakdown */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Deduction Categories</div>
          </div>
          {deductionPieData.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 0' }}><div className="empty-state-icon"><BarChart3 size={22} /></div><div className="empty-state-title">No deductions</div></div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={deductionPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} strokeWidth={2} stroke="var(--bg-surface)">
                  {deductionPieData.map((_, i) => (
                    <Cell key={i} fill={['#f87171','#fb923c','#f43f5e','#a78bfa'][i % 4]} />
                  ))}
                </Pie>
                <Tooltip formatter={v => formatCurrency(v, true)} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)' }} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Department Table */}
      {deptData.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Department Summary</div>
          </div>
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Calculations</th>
                  <th>Total Gross</th>
                  <th>Total Net</th>
                  <th>Avg Net/Record</th>
                  <th>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {deptData.map(d => (
                  <tr key={d.name}>
                    <td><span className="badge badge-muted">{d.name}</span></td>
                    <td className="td-mono">{d.count}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-lime)' }}>{formatCurrency(d.gross)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>{formatCurrency(d.net)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(d.count > 0 ? d.net / d.count : 0)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                          <div style={{ height: '100%', background: 'var(--accent-lime)', width: `${totalGross > 0 ? (d.gross / totalGross) * 100 : 0}%`, borderRadius: 3 }} />
                        </div>
                        <span className="td-mono">{totalGross > 0 ? ((d.gross / totalGross) * 100).toFixed(1) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
