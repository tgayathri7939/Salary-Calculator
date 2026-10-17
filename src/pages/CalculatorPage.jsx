import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calculator as CalcIcon, RotateCcw, Save, Printer, Download, FileText, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { getEmployees, saveSalaryCalculation } from '../services/db.js';
import { exportSalaryStatementPDF, exportSingleCalculationCSV } from '../services/exports.js';
import {
  calculateSalary, formatCurrency, validateSalaryInputs,
  generateCalcId, generateEmployeeId
} from '../utils/salaryCalc.js';

const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Legal', 'Customer Support', 'Other'];

const DEFAULT_INPUTS = {
  employeeId: '', employeeName: '', department: '', jobTitle: '',
  payPeriod: 'monthly',
  basicSalary: '', hra: '', otherAllowances: '', bonus: '', overtime: '',
  providentFund: '', professionalTax: '', incomeTax: '', otherDeductions: '',
};

function SalaryBar({ pct, color, label, amount }) {
  return (
    <div className="breakdown-row">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="breakdown-label">{label}</div>
        <div className="salary-bar" style={{ marginTop: 4 }}>
          <div className="salary-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
        </div>
      </div>
      <span className="breakdown-pct">{pct.toFixed(1)}%</span>
      <span className="breakdown-amount">{formatCurrency(amount)}</span>
    </div>
  );
}

export default function CalculatorPage() {
  const { user } = useAuth();
  const { settings } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [inputs, setInputs] = useState({ ...DEFAULT_INPUTS, payPeriod: settings.defaultPayPeriod || 'monthly' });
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [saving, setSaving] = useState(false);
  const [useHraPct, setUseHraPct] = useState(false);
  const [usePfPct, setUsePfPct] = useState(false);

  // Load employees for quick-fill
  useEffect(() => {
    if (!user) return;
    getEmployees(user.uid).then(setEmployees).catch(() => {});
  }, [user]);

  // Pre-fill from URL params (e.g. from employee page)
  useEffect(() => {
    const emp = searchParams.get('employee');
    if (emp) {
      try {
        const data = JSON.parse(decodeURIComponent(emp));
        setInputs(prev => ({ ...prev, ...data }));
      } catch {}
    }
  }, [searchParams]);

  // Auto-calculate when inputs change
  useEffect(() => {
    const computed = buildNumericInputs(inputs);
    if (Object.values(computed).some(v => v > 0)) {
      const res = calculateSalary({ ...computed, payPeriod: inputs.payPeriod });
      setResult(res);
    }
  }, [inputs]);

  function buildNumericInputs(inp) {
    const basic = parseFloat(inp.basicSalary) || 0;
    const hraVal = useHraPct
      ? basic * ((settings.hraPercentage || 40) / 100)
      : parseFloat(inp.hra) || 0;
    const pfVal = usePfPct
      ? basic * ((settings.pfPercentage || 12) / 100)
      : parseFloat(inp.providentFund) || 0;

    return {
      basicSalary:    basic,
      hra:            hraVal,
      otherAllowances: parseFloat(inp.otherAllowances) || 0,
      bonus:          parseFloat(inp.bonus) || 0,
      overtime:       parseFloat(inp.overtime) || 0,
      providentFund:  pfVal,
      professionalTax: parseFloat(inp.professionalTax) || 0,
      incomeTax:      parseFloat(inp.incomeTax) || 0,
      otherDeductions: parseFloat(inp.otherDeductions) || 0,
    };
  }

  function set(field) {
    return (e) => {
      setInputs(prev => ({ ...prev, [field]: e.target.value }));
      setErrors(prev => ({ ...prev, [field]: '' }));
    };
  }

  function handleEmployeeSelect(e) {
    const id = e.target.value;
    setSelectedEmployee(id);
    if (!id) return;
    const emp = employees.find(em => em.id === id);
    if (emp) {
      setInputs(prev => ({
        ...prev,
        employeeId:   emp.employeeId || emp.id,
        employeeName: emp.name,
        department:   emp.department || '',
        jobTitle:     emp.jobTitle || '',
      }));
    }
  }

  function handleReset() {
    setInputs({ ...DEFAULT_INPUTS, payPeriod: settings.defaultPayPeriod || 'monthly' });
    setResult(null);
    setErrors({});
    setSelectedEmployee('');
    setUseHraPct(false);
    setUsePfPct(false);
  }

  function handleCalculate() {
    const numeric = buildNumericInputs(inputs);
    const errs = validateSalaryInputs({ ...inputs, ...numeric });
    if (errs.length) {
      const errMap = {};
      errs.forEach(e => { const [field] = e.split(':'); errMap[field] = e.split(': ')[1] || e; });
      setErrors(errMap);
      if (!inputs.employeeName?.trim()) {
        toast.error('Validation failed', 'Employee name is required.');
        return;
      }
    }
    const res = calculateSalary({ ...numeric, payPeriod: inputs.payPeriod });
    setResult(res);
    if (res.warnings.length) {
      res.warnings.forEach(w => toast.warning('Calculation Warning', w));
    } else {
      toast.success('Calculated', `Net salary: ${formatCurrency(res.netSalary)}`);
    }
  }

  async function handleSave() {
    if (!result) { toast.error('Nothing to save', 'Calculate first.'); return; }
    if (!inputs.employeeName?.trim()) { toast.error('Missing info', 'Employee name is required to save.'); return; }

    setSaving(true);
    try {
      const numeric = buildNumericInputs(inputs);
      const record = {
        id:            generateCalcId(),
        employeeId:    inputs.employeeId || generateEmployeeId(inputs.department),
        employeeName:  inputs.employeeName,
        department:    inputs.department,
        jobTitle:      inputs.jobTitle,
        payPeriod:     inputs.payPeriod,
        ...numeric,
        grossSalary:   result.grossSalary,
        totalDeductions: result.totalDeductions,
        netSalary:     result.netSalary,
        deductionPct:  result.deductionPct,
        annualGross:   result.annualGross,
        annualNet:     result.annualNet,
      };
      await saveSalaryCalculation(user.uid, record);
      toast.success('Saved', `Salary record for ${inputs.employeeName} saved successfully.`);
    } catch (err) {
      toast.error('Save failed', err.message || 'Could not save the record.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePDF() {
    if (!result) { toast.error('Nothing to export', 'Calculate first.'); return; }
    try {
      const numeric = buildNumericInputs(inputs);
      await exportSalaryStatementPDF({ ...inputs, ...numeric, ...result });
      toast.success('PDF downloaded', 'Salary statement saved to your device.');
    } catch (err) {
      toast.error('PDF failed', err.message || 'Could not generate PDF.');
    }
  }

  function handleCSV() {
    if (!result) { toast.error('Nothing to export', 'Calculate first.'); return; }
    const numeric = buildNumericInputs(inputs);
    exportSingleCalculationCSV({ ...inputs, ...numeric, ...result });
    toast.success('CSV downloaded', 'Salary breakdown exported.');
  }

  function handlePrint() {
    window.print();
  }

  const hraPctValue = useHraPct && inputs.basicSalary
    ? (parseFloat(inputs.basicSalary) || 0) * ((settings.hraPercentage || 40) / 100)
    : null;

  const pfPctValue = usePfPct && inputs.basicSalary
    ? (parseFloat(inputs.basicSalary) || 0) * ((settings.pfPercentage || 12) / 100)
    : null;

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Salary Calculator</h1>
          <p className="page-subtitle">
            Calculate gross, deductions, and net salary with full Indian tax components.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={handleReset} id="calc-reset-btn">
            <RotateCcw size={14} /> Reset
          </button>
          <button className="btn btn-primary" onClick={handleCalculate} id="calc-calculate-btn">
            <CalcIcon size={15} /> Calculate
          </button>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 20 }} role="note">
        <Info size={15} style={{ flexShrink: 0 }} />
        <span>
          <strong>Illustrative calculations only</strong> — These figures are not official tax advice.
          Consult a qualified financial advisor for statutory compliance.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
        {/* ── Input Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Employee Info */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Employee Information</div>
            </div>

            {employees.length > 0 && (
              <div className="form-group">
                <label className="form-label" htmlFor="calc-emp-select">Quick Fill from Employee</label>
                <select id="calc-emp-select" className="form-select" value={selectedEmployee} onChange={handleEmployeeSelect}>
                  <option value="">— Select employee —</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.employeeId || e.id})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="calc-emp-id">Employee ID</label>
                <input id="calc-emp-id" className={`form-input ${errors.employeeId ? 'error' : ''}`} placeholder="ENG-1234" value={inputs.employeeId} onChange={set('employeeId')} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="calc-emp-name">Employee Name *</label>
                <input id="calc-emp-name" className={`form-input ${errors.employeeName ? 'error' : ''}`} placeholder="Jane Doe" value={inputs.employeeName} onChange={set('employeeName')} />
                {errors.employeeName && <span className="form-error">{errors.employeeName}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="calc-dept">Department</label>
                <select id="calc-dept" className="form-select" value={inputs.department} onChange={set('department')}>
                  <option value="">— Select —</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="calc-title">Job Title</label>
                <input id="calc-title" className="form-input" placeholder="Software Engineer" value={inputs.jobTitle} onChange={set('jobTitle')} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Pay Period</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['monthly', 'annual'].map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`btn ${inputs.payPeriod === p ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => setInputs(prev => ({ ...prev, payPeriod: p }))}
                    id={`pay-period-${p}`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              <span className="form-hint">All amounts below are interpreted as {inputs.payPeriod} figures.</span>
            </div>
          </div>

          {/* Earnings */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ color: 'var(--accent-lime)' }}>Earnings</div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="calc-basic">Basic Salary (₹)</label>
                <div className="input-wrapper">
                  <span className="input-prefix">₹</span>
                  <input id="calc-basic" className="form-input" type="number" min="0" placeholder="30000" value={inputs.basicSalary} onChange={set('basicSalary')} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="calc-hra">
                  HRA (₹)
                  <button
                    type="button"
                    onClick={() => setUseHraPct(p => !p)}
                    style={{ marginLeft: 8, fontSize: 11, color: useHraPct ? 'var(--accent-lime)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                  >
                    {useHraPct ? `Auto ${settings.hraPercentage || 40}% ✓` : 'Use %'}
                  </button>
                </label>
                {useHraPct ? (
                  <div className="input-wrapper">
                    <input className="form-input" disabled value={hraPctValue !== null ? hraPctValue.toFixed(0) : ''} placeholder="Auto" style={{ opacity: 0.7 }} />
                    {hraPctValue !== null && <span className="input-suffix">{settings.hraPercentage || 40}% of basic</span>}
                  </div>
                ) : (
                  <div className="input-wrapper">
                    <span className="input-prefix">₹</span>
                    <input id="calc-hra" className="form-input" type="number" min="0" placeholder="12000" value={inputs.hra} onChange={set('hra')} />
                  </div>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="calc-allowances">Other Allowances (₹)</label>
                <div className="input-wrapper">
                  <span className="input-prefix">₹</span>
                  <input id="calc-allowances" className="form-input" type="number" min="0" placeholder="2000" value={inputs.otherAllowances} onChange={set('otherAllowances')} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="calc-bonus">Bonus (₹)</label>
                <div className="input-wrapper">
                  <span className="input-prefix">₹</span>
                  <input id="calc-bonus" className="form-input" type="number" min="0" placeholder="1000" value={inputs.bonus} onChange={set('bonus')} />
                </div>
              </div>
            </div>

            <div className="form-group" style={{ maxWidth: '50%' }}>
              <label className="form-label" htmlFor="calc-overtime">Overtime (₹)</label>
              <div className="input-wrapper">
                <span className="input-prefix">₹</span>
                <input id="calc-overtime" className="form-input" type="number" min="0" placeholder="0" value={inputs.overtime} onChange={set('overtime')} />
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ color: 'var(--accent-red)' }}>Deductions</div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="calc-pf">
                  Provident Fund (₹)
                  <button
                    type="button"
                    onClick={() => setUsePfPct(p => !p)}
                    style={{ marginLeft: 8, fontSize: 11, color: usePfPct ? 'var(--accent-lime)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                  >
                    {usePfPct ? `Auto ${settings.pfPercentage || 12}% ✓` : 'Use %'}
                  </button>
                </label>
                {usePfPct ? (
                  <div className="input-wrapper">
                    <input className="form-input" disabled value={pfPctValue !== null ? pfPctValue.toFixed(0) : ''} placeholder="Auto" style={{ opacity: 0.7 }} />
                    {pfPctValue !== null && <span className="input-suffix">{settings.pfPercentage || 12}% of basic</span>}
                  </div>
                ) : (
                  <div className="input-wrapper">
                    <span className="input-prefix">₹</span>
                    <input id="calc-pf" className="form-input" type="number" min="0" placeholder="3600" value={inputs.providentFund} onChange={set('providentFund')} />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="calc-proftax">Professional Tax (₹)</label>
                <div className="input-wrapper">
                  <span className="input-prefix">₹</span>
                  <input id="calc-proftax" className="form-input" type="number" min="0" placeholder="200" value={inputs.professionalTax} onChange={set('professionalTax')} />
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="calc-incometax">Income Tax (₹)</label>
                <div className="input-wrapper">
                  <span className="input-prefix">₹</span>
                  <input id="calc-incometax" className="form-input" type="number" min="0" placeholder="1000" value={inputs.incomeTax} onChange={set('incomeTax')} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="calc-otherded">Other Deductions (₹)</label>
                <div className="input-wrapper">
                  <span className="input-prefix">₹</span>
                  <input id="calc-otherded" className="form-input" type="number" min="0" placeholder="200" value={inputs.otherDeductions} onChange={set('otherDeductions')} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Result Panel ── */}
        <div style={{ position: 'sticky', top: 'calc(var(--header-h) + 20px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!result ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon"><CalcIcon size={28} /></div>
                <div className="empty-state-title">Ready to calculate</div>
                <div className="empty-state-text">Fill in salary components and click Calculate to see results.</div>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={handleCalculate} id="calc-result-cta">
                  Calculate Now
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="result-panel">
                <div className="result-header">
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                      {inputs.payPeriod === 'monthly' ? 'Monthly' : 'Annual'} Net Salary
                    </div>
                    <div className="result-net">{formatCurrency(result.netSalary)}</div>
                  </div>
                  {result.warnings.length > 0 && (
                    <div title={result.warnings.join('\n')}>
                      <AlertTriangle size={20} style={{ color: 'var(--accent-amber)' }} />
                    </div>
                  )}
                </div>

                {result.warnings.map((w, i) => (
                  <div key={i} className="alert alert-warning" style={{ margin: '0 16px 12px', fontSize: 12 }}>
                    <AlertTriangle size={13} /> {w}
                  </div>
                ))}

                <div className="result-grid">
                  <div className="result-col">
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>GROSS SALARY</div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-lime)' }}>{formatCurrency(result.grossSalary)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{inputs.payPeriod === 'monthly' ? `Annual: ${formatCurrency(result.annualGross, true)}` : 'Annual (as entered)'}</div>
                  </div>
                  <div className="result-divider" />
                  <div className="result-col">
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>TOTAL DEDUCTIONS</div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-red)' }}>{formatCurrency(result.totalDeductions)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{result.deductionPct.toFixed(1)}% of gross</div>
                  </div>
                </div>

                {/* Composition Bar */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>EARNINGS / DEDUCTIONS</div>
                  <div className="composition-bar">
                    <div className="comp-earnings" style={{ width: `${100 - result.deductionPct}%` }} />
                    <div className="comp-deductions" style={{ width: `${result.deductionPct}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                    <span style={{ color: 'var(--accent-lime)' }}>Net {(100 - result.deductionPct).toFixed(1)}%</span>
                    <span style={{ color: 'var(--accent-red)' }}>Ded {result.deductionPct.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Earnings Breakdown */}
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}>Earnings Breakdown</div>
                {result.earnings.map(e => (
                  <SalaryBar key={e.label} label={e.label} amount={e.amount} pct={e.pct} color={e.color} />
                ))}
                <div className="breakdown-row" style={{ marginTop: 8 }}>
                  <div className="breakdown-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Gross Total</div>
                  <span className="breakdown-amount" style={{ fontWeight: 700, color: 'var(--accent-lime)' }}>{formatCurrency(result.grossSalary)}</span>
                </div>
              </div>

              {/* Deductions Breakdown */}
              {result.deductions.length > 0 && (
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 12, color: 'var(--accent-red)' }}>Deductions Breakdown</div>
                  {result.deductions.map(d => (
                    <SalaryBar key={d.label} label={d.label} amount={d.amount} pct={d.pct} color={d.color} />
                  ))}
                  <div className="breakdown-row" style={{ marginTop: 8 }}>
                    <div className="breakdown-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Total Deductions</div>
                    <span className="breakdown-amount" style={{ fontWeight: 700, color: 'var(--accent-red)' }}>{formatCurrency(result.totalDeductions)}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="calc-save-btn">
                  <Save size={15} />
                  {saving ? 'Saving…' : 'Save Salary Record'}
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={handlePDF} id="calc-pdf-btn">
                    <Download size={13} /> PDF
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleCSV} id="calc-csv-btn">
                    <FileText size={13} /> CSV
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handlePrint} id="calc-print-btn">
                    <Printer size={13} /> Print
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
