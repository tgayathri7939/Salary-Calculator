import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Download, Trash2, Eye, Copy, ChevronUp, ChevronDown,
  ChevronsUpDown, History as HistoryIcon, Printer
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import {
  getSalaryCalculations, deleteSalaryCalculation, saveSalaryCalculation
} from '../services/db.js';
import { exportCalculationsCSV, exportSalaryStatementPDF } from '../services/exports.js';
import { formatCurrency, formatDate, getPayPeriodLabel, generateCalcId } from '../utils/salaryCalc.js';

function SortIcon({ field, sort }) {
  if (sort.field !== field) return <ChevronsUpDown size={12} style={{ opacity: 0.3 }} />;
  return sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [calcs, setCalcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState({ field: 'createdAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  const [viewCalc, setViewCalc] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getSalaryCalculations(user.uid);
      setCalcs(data);
    } catch (err) {
      toast.error('Load failed', err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id) {
    try {
      await deleteSalaryCalculation(user.uid, id);
      setDeleteConfirm(null);
      setViewCalc(null);
      toast.success('Deleted', 'Calculation removed.');
      await load();
    } catch (err) {
      toast.error('Delete failed', err.message);
    }
  }

  async function handleDuplicate(calc) {
    try {
      const newCalc = { ...calc, id: generateCalcId(), createdAt: undefined, updatedAt: undefined };
      await saveSalaryCalculation(user.uid, newCalc);
      toast.success('Duplicated', `Created copy of ${calc.employeeName}'s record.`);
      await load();
    } catch (err) {
      toast.error('Duplicate failed', err.message);
    }
  }

  async function handlePDF(calc) {
    try {
      await exportSalaryStatementPDF(calc);
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error('PDF failed', err.message);
    }
  }

  function toggleSort(field) {
    setSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'desc' });
    setPage(1);
  }

  const filtered = calcs.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      c.employeeName?.toLowerCase().includes(q) ||
      c.department?.toLowerCase().includes(q) ||
      c.id?.toLowerCase().includes(q);
    const matchFrom = !dateFrom || (c.createdAt || '') >= dateFrom;
    const matchTo   = !dateTo   || (c.createdAt || '') <= dateTo + 'T23:59:59';
    return matchSearch && matchFrom && matchTo;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = (a[sort.field] || '').toString();
    const bv = (b[sort.field] || '').toString();
    return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Salary History</h1>
          <p className="page-subtitle">{calcs.length} saved calculations</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => exportCalculationsCSV(calcs)} id="history-export-csv">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="toolbar">
        <div className="search-wrapper">
          <Search size={15} className="search-icon" />
          <input
            type="search"
            className="search-input"
            placeholder="Search by name, department, ID…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            id="history-search"
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>From</span>
          <input type="date" className="form-input" style={{ width: 160 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} id="history-date-from" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>To</span>
          <input type="date" className="form-input" style={{ width: 160 }} value={dateTo} onChange={e => setDateTo(e.target.value)} id="history-date-to" />
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleSort('id')}>Calc ID <SortIcon field="id" sort={sort} /></th>
              <th onClick={() => toggleSort('employeeName')}>Employee <SortIcon field="employeeName" sort={sort} /></th>
              <th onClick={() => toggleSort('department')}>Department <SortIcon field="department" sort={sort} /></th>
              <th onClick={() => toggleSort('payPeriod')}>Period <SortIcon field="payPeriod" sort={sort} /></th>
              <th onClick={() => toggleSort('grossSalary')}>Gross <SortIcon field="grossSalary" sort={sort} /></th>
              <th onClick={() => toggleSort('totalDeductions')}>Deductions <SortIcon field="totalDeductions" sort={sort} /></th>
              <th onClick={() => toggleSort('netSalary')}>Net Salary <SortIcon field="netSalary" sort={sort} /></th>
              <th onClick={() => toggleSort('createdAt')}>Date <SortIcon field="createdAt" sort={sort} /></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 13, width: '70%' }} /></td>
                  ))}
                </tr>
              ))
            ) : pageData.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><HistoryIcon size={24} /></div>
                    <div className="empty-state-title">
                      {calcs.length === 0 ? 'No calculations saved yet' : 'No results found'}
                    </div>
                    <div className="empty-state-text">
                      {calcs.length === 0
                        ? 'Use the Salary Calculator to save records here.'
                        : 'Try adjusting your search or date filters.'}
                    </div>
                    {calcs.length === 0 && (
                      <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('/calculator')}>
                        Open Calculator
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              pageData.map(c => (
                <tr key={c.id}>
                  <td className="td-mono" style={{ fontSize: 11 }}>{c.id?.slice(0, 16)}…</td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{c.employeeName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{c.employeeId}</div>
                  </td>
                  <td><span className="badge badge-muted">{c.department || '—'}</span></td>
                  <td className="td-mono">{getPayPeriodLabel(c.payPeriod)}</td>
                  <td className="td-mono" style={{ color: 'var(--accent-lime)' }}>{formatCurrency(c.grossSalary)}</td>
                  <td className="td-mono" style={{ color: 'var(--accent-red)' }}>{formatCurrency(c.totalDeductions)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatCurrency(c.netSalary)}
                  </td>
                  <td className="td-mono">{formatDate(c.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewCalc(c)} title="View details" id={`view-calc-${c.id}`}><Eye size={13} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDuplicate(c)} title="Duplicate as draft" id={`dup-calc-${c.id}`}><Copy size={13} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handlePDF(c)} title="Download PDF" id={`pdf-calc-${c.id}`}><Download size={13} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeleteConfirm(c.id)} title="Delete" style={{ color: 'var(--accent-red)' }} id={`del-calc-${c.id}`}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            const p = totalPages <= 7 ? i + 1 : Math.max(1, Math.min(totalPages - 6, page - 3)) + i;
            return (
              <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
            );
          })}
          <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
        </div>
      )}

      {/* Detail View Modal */}
      {viewCalc && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewCalc(null)}>
          <div className="modal modal-lg" role="dialog" aria-modal="true" aria-label="Calculation Details">
            <div className="modal-header">
              <h2 className="modal-title">Salary Statement</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewCalc(null)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                ['Employee', viewCalc.employeeName],
                ['Employee ID', viewCalc.employeeId],
                ['Department', viewCalc.department],
                ['Job Title', viewCalc.jobTitle],
                ['Pay Period', getPayPeriodLabel(viewCalc.payPeriod)],
                ['Date', formatDate(viewCalc.createdAt)],
              ].map(([label, val]) => (
                <div key={label} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 3, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{val || '—'}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--accent-lime)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>EARNINGS</div>
                {[
                  ['Basic Salary', viewCalc.basicSalary],
                  ['HRA', viewCalc.hra],
                  ['Other Allowances', viewCalc.otherAllowances],
                  ['Bonus', viewCalc.bonus],
                  ['Overtime', viewCalc.overtime],
                ].filter(([,v]) => v > 0).map(([label, val]) => (
                  <div className="breakdown-row" key={label} style={{ padding: '7px 0' }}>
                    <span className="breakdown-label">{label}</span>
                    <span className="breakdown-amount" style={{ fontSize: 13 }}>{formatCurrency(val)}</span>
                  </div>
                ))}
                <div className="breakdown-row" style={{ padding: '8px 0', borderTop: '1px solid var(--border-light)', marginTop: 4 }}>
                  <span className="breakdown-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Gross</span>
                  <span className="breakdown-amount" style={{ color: 'var(--accent-lime)', fontWeight: 700 }}>{formatCurrency(viewCalc.grossSalary)}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>DEDUCTIONS</div>
                {[
                  ['Provident Fund', viewCalc.providentFund],
                  ['Professional Tax', viewCalc.professionalTax],
                  ['Income Tax', viewCalc.incomeTax],
                  ['Other Deductions', viewCalc.otherDeductions],
                ].filter(([,v]) => v > 0).map(([label, val]) => (
                  <div className="breakdown-row" key={label} style={{ padding: '7px 0' }}>
                    <span className="breakdown-label">{label}</span>
                    <span className="breakdown-amount" style={{ fontSize: 13 }}>{formatCurrency(val)}</span>
                  </div>
                ))}
                <div className="breakdown-row" style={{ padding: '8px 0', borderTop: '1px solid var(--border-light)', marginTop: 4 }}>
                  <span className="breakdown-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Total Deductions</span>
                  <span className="breakdown-amount" style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{formatCurrency(viewCalc.totalDeductions)}</span>
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>NET SALARY</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--accent-lime)' }}>{formatCurrency(viewCalc.netSalary)}</span>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost btn-sm" onClick={() => handleDuplicate(viewCalc)} id="modal-dup-btn"><Copy size={13} /> Duplicate Draft</button>
              <button className="btn btn-secondary btn-sm" onClick={() => handlePDF(viewCalc)} id="modal-pdf-btn"><Download size={13} /> PDF</button>
              <button className="btn btn-ghost btn-sm" onClick={() => window.print()} id="modal-print-btn"><Printer size={13} /> Print</button>
              <button className="btn btn-danger btn-sm" onClick={() => { setDeleteConfirm(viewCalc.id); }} id="modal-delete-btn"><Trash2 size={13} /> Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal" role="alertdialog">
            <div className="modal-header">
              <h2 className="modal-title">Delete Calculation</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
              This will permanently remove this salary record. This action cannot be undone.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)} id="history-confirm-delete">
                <Trash2 size={14} /> Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
