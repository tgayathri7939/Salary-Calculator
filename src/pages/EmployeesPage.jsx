import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Filter, Edit2, Trash2, Calculator, Eye,
  ChevronUp, ChevronDown, ChevronsUpDown, Download, Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import {
  getEmployees, addEmployee, updateEmployee, deleteEmployee
} from '../services/db.js';
import { exportEmployeesCSV, exportEmployeesPDF } from '../services/exports.js';
import { formatDate, generateEmployeeId, getInitials } from '../utils/salaryCalc.js';

const DEPARTMENTS = ['Engineering','Product','Design','Sales','Marketing','HR','Finance','Operations','Legal','Customer Support','Other'];
const STATUSES    = ['active','inactive','on-leave'];

const DEFAULT_FORM = {
  name: '', email: '', department: '', jobTitle: '',
  joiningDate: '', status: 'active', employeeId: '',
};

function SortIcon({ field, sort }) {
  if (sort.field !== field) return <ChevronsUpDown size={12} style={{ opacity: 0.3 }} />;
  return sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
}

function StatusBadge({ status }) {
  const map = {
    active:    { cls: 'badge-lime',    label: 'Active' },
    inactive:  { cls: 'badge-muted',  label: 'Inactive' },
    'on-leave':{ cls: 'badge-amber',  label: 'On Leave' },
  };
  const { cls, label } = map[status] || map.inactive;
  return <span className={`badge ${cls}`}>{label}</span>;
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sort, setSort] = useState({ field: 'createdAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // employee id

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getEmployees(user.uid);
      setEmployees(data);
    } catch (err) {
      toast.error('Load failed', err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Open add modal from URL param
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      openAdd();
    }
  }, [searchParams]);

  function openAdd() {
    setForm({ ...DEFAULT_FORM, employeeId: generateEmployeeId('EMP') });
    setEditingId(null);
    setFormErrors({});
    setShowModal(true);
  }

  function openEdit(emp) {
    setForm({
      name: emp.name, email: emp.email, department: emp.department,
      jobTitle: emp.jobTitle, joiningDate: emp.joiningDate || '',
      status: emp.status || 'active', employeeId: emp.employeeId || emp.id,
    });
    setEditingId(emp.id);
    setFormErrors({});
    setShowModal(true);
  }

  function validateForm() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!form.email.trim()) errs.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email.';
    if (!form.department) errs.department = 'Department is required.';
    if (!form.employeeId.trim()) errs.employeeId = 'Employee ID is required.';
    return errs;
  }

  async function handleSave() {
    const errs = validateForm();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateEmployee(user.uid, editingId, { ...form });
        toast.success('Updated', `${form.name}'s profile updated.`);
      } else {
        await addEmployee(user.uid, { ...form, id: form.employeeId || undefined });
        toast.success('Added', `${form.name} added to the team.`);
      }
      setShowModal(false);
      await load();
    } catch (err) {
      toast.error('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteEmployee(user.uid, id);
      setDeleteConfirm(null);
      toast.success('Deleted', 'Employee record removed.');
      await load();
    } catch (err) {
      toast.error('Delete failed', err.message);
    }
  }

  function handleCalculate(emp) {
    const params = encodeURIComponent(JSON.stringify({
      employeeId:   emp.employeeId || emp.id,
      employeeName: emp.name,
      department:   emp.department,
      jobTitle:     emp.jobTitle,
    }));
    navigate(`/calculator?employee=${params}`);
  }

  // Filtering + sorting
  const filtered = employees.filter(e => {
    const matchSearch = !search ||
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase()) ||
      (e.employeeId || e.id)?.toLowerCase().includes(search.toLowerCase());
    const matchDept   = !filterDept   || e.department === filterDept;
    const matchStatus = !filterStatus || e.status === filterStatus;
    return matchSearch && matchDept && matchStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = (a[sort.field] || '').toString().toLowerCase();
    const bv = (b[sort.field] || '').toString().toLowerCase();
    return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(field) {
    setSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });
    setPage(1);
  }

  function setField(f) {
    return (e) => {
      setForm(p => ({ ...p, [f]: e.target.value }));
      setFormErrors(p => ({ ...p, [f]: '' }));
    };
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">{employees.length} total · Manage your workforce records</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => exportEmployeesCSV(employees)} id="emp-export-csv">
            <Download size={14} /> CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => exportEmployeesPDF(employees)} id="emp-export-pdf">
            <Download size={14} /> PDF
          </button>
          <button className="btn btn-primary" onClick={openAdd} id="emp-add-btn">
            <Plus size={15} /> Add Employee
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrapper">
          <Search size={15} className="search-icon" />
          <input
            type="search"
            className="search-input"
            placeholder="Search by name, email, or ID…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            id="emp-search"
          />
        </div>
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: 150 }}
          value={filterDept}
          onChange={e => { setFilterDept(e.target.value); setPage(1); }}
          id="emp-filter-dept"
        >
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: 140 }}
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          id="emp-filter-status"
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleSort('employeeId')} id="sort-id">ID <SortIcon field="employeeId" sort={sort} /></th>
              <th onClick={() => toggleSort('name')} id="sort-name">Name <SortIcon field="name" sort={sort} /></th>
              <th onClick={() => toggleSort('department')} id="sort-dept">Department <SortIcon field="department" sort={sort} /></th>
              <th onClick={() => toggleSort('jobTitle')} id="sort-title">Job Title <SortIcon field="jobTitle" sort={sort} /></th>
              <th onClick={() => toggleSort('status')} id="sort-status">Status <SortIcon field="status" sort={sort} /></th>
              <th onClick={() => toggleSort('joiningDate')} id="sort-date">Joined <SortIcon field="joiningDate" sort={sort} /></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 14, width: j === 1 ? '80%' : '60%' }} /></td>
                  ))}
                </tr>
              ))
            ) : pageData.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><Users size={24} /></div>
                    <div className="empty-state-title">
                      {employees.length === 0 ? 'No employees yet' : 'No results found'}
                    </div>
                    <div className="empty-state-text">
                      {employees.length === 0
                        ? 'Add your first employee to get started.'
                        : 'Try adjusting your search or filters.'}
                    </div>
                    {employees.length === 0 && (
                      <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={openAdd}>
                        <Plus size={13} /> Add Employee
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              pageData.map(emp => (
                <tr key={emp.id}>
                  <td className="td-mono">{emp.employeeId || emp.id}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="user-avatar" style={{ width: 30, height: 30, fontSize: 11, flexShrink: 0 }}>
                        {getInitials(emp.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-muted">{emp.department}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{emp.jobTitle}</td>
                  <td><StatusBadge status={emp.status} /></td>
                  <td className="td-mono">{formatDate(emp.joiningDate)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => handleCalculate(emp)}
                        title="Calculate salary"
                        id={`emp-calc-${emp.id}`}
                      >
                        <Calculator size={13} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => openEdit(emp)}
                        title="Edit employee"
                        id={`emp-edit-${emp.id}`}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => setDeleteConfirm(emp.id)}
                        title="Delete employee"
                        style={{ color: 'var(--accent-red)' }}
                        id={`emp-delete-${emp.id}`}
                      >
                        <Trash2 size={13} />
                      </button>
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg" role="dialog" aria-modal="true" aria-label={editingId ? 'Edit Employee' : 'Add Employee'}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Employee' : 'Add New Employee'}</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowModal(false)} aria-label="Close modal">✕</button>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="emp-form-id">Employee ID *</label>
                <input id="emp-form-id" className={`form-input ${formErrors.employeeId ? 'error' : ''}`} value={form.employeeId} onChange={setField('employeeId')} placeholder="EMP-1234" />
                {formErrors.employeeId && <span className="form-error">{formErrors.employeeId}</span>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="emp-form-name">Full Name *</label>
                <input id="emp-form-name" className={`form-input ${formErrors.name ? 'error' : ''}`} value={form.name} onChange={setField('name')} placeholder="Jane Doe" />
                {formErrors.name && <span className="form-error">{formErrors.name}</span>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="emp-form-email">Email Address *</label>
              <input id="emp-form-email" type="email" className={`form-input ${formErrors.email ? 'error' : ''}`} value={form.email} onChange={setField('email')} placeholder="jane@company.com" />
              {formErrors.email && <span className="form-error">{formErrors.email}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="emp-form-dept">Department *</label>
                <select id="emp-form-dept" className={`form-select ${formErrors.department ? 'error' : ''}`} value={form.department} onChange={setField('department')}>
                  <option value="">— Select —</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {formErrors.department && <span className="form-error">{formErrors.department}</span>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="emp-form-title">Job Title</label>
                <input id="emp-form-title" className="form-input" value={form.jobTitle} onChange={setField('jobTitle')} placeholder="Software Engineer" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="emp-form-joining">Joining Date</label>
                <input id="emp-form-joining" type="date" className="form-input" value={form.joiningDate} onChange={setField('joiningDate')} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="emp-form-status">Employment Status</label>
                <select id="emp-form-status" className="form-select" value={form.status} onChange={setField('status')}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on-leave">On Leave</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="emp-save-btn">
                {saving ? 'Saving…' : editingId ? 'Update Employee' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal" role="alertdialog" aria-modal="true">
            <div className="modal-header">
              <h2 className="modal-title">Delete Employee</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
              Are you sure you want to delete this employee? Their salary history will remain,
              but the employee profile will be permanently removed.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)} id="emp-confirm-delete">
                <Trash2 size={14} /> Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
