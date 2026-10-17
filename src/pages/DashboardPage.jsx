import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator, Users, History, BarChart3,
  TrendingUp, DollarSign, Minus, ArrowUpRight, Plus
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Legend
} from 'recharts';
import { useAuth } from '../contexts/AuthContext.jsx';
import { getEmployees, getSalaryCalculations, getActivityLogs } from '../services/db.js';
import { formatCurrency, formatDate, summarizePayroll, DEPT_COLORS } from '../utils/salaryCalc.js';

function AnimatedNumber({ value, prefix = '', decimals = 0 }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);
  const start = useRef(null);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const duration = 800;
    const from = 0;
    const to = value;

    function step(ts) {
      if (!start.current) start.current = ts;
      const progress = Math.min((ts - start.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) raf.current = requestAnimationFrame(step);
    }

    start.current = null;
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.floor(display).toLocaleString('en-IN');

  return <span className="count-up">{prefix}{formatted}</span>;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-medium)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 14px',
      fontSize: 12,
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {formatCurrency(p.value, true)}
        </div>
      ))}
    </div>
  );
};

function SkeletonCard() {
  return (
    <div className="stat-card">
      <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8, marginBottom: 14 }} />
      <div className="skeleton" style={{ width: '60%', height: 10, marginBottom: 10 }} />
      <div className="skeleton" style={{ width: '80%', height: 22 }} />
    </div>
  );
}

export default function DashboardPage() {
  const { user, isDemo } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [calcs, setCalcs] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const monthName = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getEmployees(user.uid),
      getSalaryCalculations(user.uid),
      getActivityLogs(user.uid, 10),
    ]).then(([emps, cs, acts]) => {
      setEmployees(emps);
      setCalcs(cs);
      setActivity(acts);
    }).finally(() => setLoading(false));
  }, [user]);

  // Current period (this month's calcs)
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthCalcs = calcs.filter(c => c.createdAt?.startsWith(currentMonth));
  const { totalGross, totalNet, totalDed } = summarizePayroll(thisMonthCalcs);
  const allTime = summarizePayroll(calcs);

  // Monthly trend (last 6 months)
  const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-IN', { month: 'short' });
    const monthCalcs = calcs.filter(c => c.createdAt?.startsWith(key));
    const { totalGross: gross, totalNet: net } = summarizePayroll(monthCalcs);
    return { month: label, gross, net };
  });

  // Department distribution
  const deptMap = {};
  calcs.forEach(c => {
    const dept = c.department || 'Other';
    deptMap[dept] = (deptMap[dept] || 0) + (c.grossSalary || 0);
  });
  const deptData = Object.entries(deptMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const quickActions = [
    { icon: Calculator, label: 'Calculate Salary',  desc: 'Run a new calculation',  path: '/calculator',         color: 'var(--accent-lime)' },
    { icon: Plus,       label: 'Add Employee',      desc: 'Register new staff',      path: '/employees?action=add', color: 'var(--accent-lavender)' },
    { icon: History,    label: 'View History',      desc: 'Browse past records',     path: '/history',            color: 'var(--accent-green)' },
    { icon: BarChart3,  label: 'Export Report',     desc: 'Download payroll data',   path: '/reports',            color: 'var(--accent-amber)' },
  ];

  const hasData = calcs.length > 0;

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">
            Good {now.getHours() < 12 ? 'morning' : now.getHours() < 18 ? 'afternoon' : 'evening'},{' '}
            {user?.displayName?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}{monthName} payroll overview
          </p>
        </div>
      </div>

      {isDemo && (
        <div className="demo-banner">
          <span>⚠</span>
          <strong>Demo Mode Active</strong> — All data is stored locally in your browser. Configure Firebase for production use.
        </div>
      )}

      {/* Stat Cards */}
      <div className="stat-grid">
        {loading ? (
          [1,2,3,4].map(i => <SkeletonCard key={i} />)
        ) : (
          <>
            <div className="stat-card">
              <div className="stat-card-icon" style={{ background: 'rgba(200,241,53,0.1)' }}>
                <Users size={18} style={{ color: 'var(--accent-lime)' }} />
              </div>
              <div className="stat-card-label">Total Employees</div>
              <div className="stat-card-value">
                <AnimatedNumber value={employees.length} />
              </div>
              <div className="stat-card-sub">
                {employees.filter(e => e.status === 'active').length} active
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-icon" style={{ background: 'rgba(96,165,250,0.1)' }}>
                <TrendingUp size={18} style={{ color: '#60a5fa' }} />
              </div>
              <div className="stat-card-label">This Month Gross</div>
              <div className="stat-card-value" style={{ fontSize: 20 }}>
                ₹<AnimatedNumber value={totalGross} />
              </div>
              <div className="stat-card-sub">{thisMonthCalcs.length} calculations</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-icon" style={{ background: 'rgba(248,113,113,0.1)' }}>
                <Minus size={18} style={{ color: 'var(--accent-red)' }} />
              </div>
              <div className="stat-card-label">This Month Deductions</div>
              <div className="stat-card-value" style={{ fontSize: 20, color: 'var(--accent-red)' }}>
                ₹<AnimatedNumber value={totalDed} />
              </div>
              <div className="stat-card-sub">
                {totalGross > 0 ? ((totalDed / totalGross) * 100).toFixed(1) : '0'}% of gross
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-icon" style={{ background: 'rgba(74,222,128,0.1)' }}>
                <DollarSign size={18} style={{ color: 'var(--accent-green)' }} />
              </div>
              <div className="stat-card-label">This Month Net</div>
              <div className="stat-card-value" style={{ fontSize: 20, color: 'var(--accent-green)' }}>
                ₹<AnimatedNumber value={totalNet} />
              </div>
              <div className="stat-card-sub">Take-home payroll</div>
            </div>
          </>
        )}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Monthly Trend */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Monthly Payroll Trend</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Last 6 months — Gross vs Net</div>
            </div>
          </div>
          {!hasData ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-state-icon"><BarChart3 size={24} /></div>
              <div className="empty-state-title">No payroll data yet</div>
              <div className="empty-state-text">Calculate your first salary to see trends here.</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyTrend} margin={{ top: 5, right: 5, bottom: 0, left: 10 }}>
                <defs>
                  <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c8f135" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#c8f135" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4ade80" stopOpacity={0.12}/>
                    <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="gross" stroke="#c8f135" strokeWidth={2} fill="url(#colorGross)" name="Gross" />
                <Area type="monotone" dataKey="net"   stroke="#4ade80" strokeWidth={2} fill="url(#colorNet)"   name="Net" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Department Distribution */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Dept. Distribution</div>
          </div>
          {!hasData || deptData.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-state-icon"><BarChart3 size={24} /></div>
              <div className="empty-state-title">No data yet</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} strokeWidth={2} stroke="var(--bg-surface)">
                  {deptData.map((_, i) => (
                    <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v, true)} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Quick Actions</div>
        </div>
        <div className="quick-actions">
          {quickActions.map((a) => (
            <button
              key={a.path}
              className="quick-action-card"
              onClick={() => navigate(a.path)}
              id={`quick-action-${a.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="qa-icon"><a.icon size={18} /></div>
              <div>
                <div className="qa-title">{a.label}</div>
                <div className="qa-desc">{a.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity + Gross vs Net */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recent Calculations */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Calculations</div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')} id="view-all-history-btn">
              View all <ArrowUpRight size={13} />
            </button>
          </div>
          {loading ? (
            [1,2,3].map(i => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 12 }}>
                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: '60%', height: 12, marginBottom: 6 }} />
                  <div className="skeleton" style={{ width: '40%', height: 10 }} />
                </div>
              </div>
            ))
          ) : calcs.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 0' }}>
              <div className="empty-state-icon"><Calculator size={22} /></div>
              <div className="empty-state-title">No calculations yet</div>
              <div className="empty-state-text">Use the calculator to save your first record.</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('/calculator')}>
                Calculate Now
              </button>
            </div>
          ) : (
            calcs.slice(0, 5).map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                onClick={() => navigate('/history')}>
                <div className="user-avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                  {(c.employeeName || 'U').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.employeeName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {c.department} · {formatDate(c.createdAt)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--accent-lime)' }}>
                    {formatCurrency(c.netSalary, true)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>net</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Gross vs Net Bar Chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Gross vs Net (Last 6 Mo)</div>
          </div>
          {!hasData ? (
            <div className="empty-state" style={{ padding: '28px 0' }}>
              <div className="empty-state-icon"><TrendingUp size={22} /></div>
              <div className="empty-state-title">No data yet</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyTrend} margin={{ top: 5, right: 5, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="gross" name="Gross" fill="#c8f135" radius={[3,3,0,0]} opacity={0.8} />
                <Bar dataKey="net"   name="Net"   fill="#4ade80" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  );
}
