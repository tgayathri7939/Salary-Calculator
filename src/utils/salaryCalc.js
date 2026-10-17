/**
 * SalaryFlow — Salary Calculation Engine
 * All monetary values are in INR (Indian Rupees).
 * DISCLAIMER: These calculations are illustrative only and not official tax advice.
 */

/**
 * Format a number as Indian currency (₹ with Indian digit grouping).
 * @param {number} amount
 * @param {boolean} compact - Use compact notation (e.g. ₹1.2L)
 */
export function formatCurrency(amount, compact = false) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  const num = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (compact) {
    if (num >= 10000000) return `${sign}₹${(num / 10000000).toFixed(2)}Cr`;
    if (num >= 100000)   return `${sign}₹${(num / 100000).toFixed(2)}L`;
    if (num >= 1000)     return `${sign}₹${(num / 1000).toFixed(1)}K`;
    return `${sign}₹${num.toFixed(0)}`;
  }

  return `${sign}₹${num.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

/**
 * Parse a currency string to a number.
 */
export function parseCurrency(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[₹,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Calculate salary components from inputs.
 * Handles both monthly and annual pay periods consistently.
 * 
 * @param {Object} inputs
 * @param {'monthly'|'annual'} inputs.payPeriod
 * @param {number} inputs.basicSalary
 * @param {number} inputs.hra
 * @param {number} inputs.otherAllowances
 * @param {number} inputs.bonus
 * @param {number} inputs.overtime
 * @param {number} inputs.providentFund
 * @param {number} inputs.professionalTax
 * @param {number} inputs.incomeTax
 * @param {number} inputs.otherDeductions
 * @returns {SalaryResult}
 */
export function calculateSalary(inputs) {
  const {
    payPeriod = 'monthly',
    basicSalary = 0,
    hra = 0,
    otherAllowances = 0,
    bonus = 0,
    overtime = 0,
    providentFund = 0,
    professionalTax = 0,
    incomeTax = 0,
    otherDeductions = 0,
  } = inputs;

  // All input values are treated as-is for the selected period.
  // No implicit multiplication — caller controls period.
  const basic = Math.max(0, Number(basicSalary) || 0);
  const hraAmt = Math.max(0, Number(hra) || 0);
  const allowances = Math.max(0, Number(otherAllowances) || 0);
  const bonusAmt = Math.max(0, Number(bonus) || 0);
  const overtimeAmt = Math.max(0, Number(overtime) || 0);
  const pfAmt = Math.max(0, Number(providentFund) || 0);
  const profTax = Math.max(0, Number(professionalTax) || 0);
  const incomeTaxAmt = Math.max(0, Number(incomeTax) || 0);
  const otherDed = Math.max(0, Number(otherDeductions) || 0);

  const grossSalary = basic + hraAmt + allowances + bonusAmt + overtimeAmt;
  const totalDeductions = pfAmt + profTax + incomeTaxAmt + otherDed;
  const netSalary = grossSalary - totalDeductions;

  const deductionPct = grossSalary > 0
    ? Math.min(100, (totalDeductions / grossSalary) * 100)
    : 0;

  const multiplier = payPeriod === 'monthly' ? 12 : 1;
  const annualGross = grossSalary * multiplier;
  const annualNet   = netSalary  * multiplier;
  const annualDeductions = totalDeductions * multiplier;

  // Component breakdowns for visualization
  const earnings = [
    { label: 'Basic Salary',      amount: basic,       pct: grossSalary > 0 ? (basic / grossSalary) * 100 : 0,       color: '#c8f135' },
    { label: 'HRA',               amount: hraAmt,      pct: grossSalary > 0 ? (hraAmt / grossSalary) * 100 : 0,      color: '#a78bfa' },
    { label: 'Other Allowances',  amount: allowances,  pct: grossSalary > 0 ? (allowances / grossSalary) * 100 : 0,  color: '#60a5fa' },
    { label: 'Bonus',             amount: bonusAmt,    pct: grossSalary > 0 ? (bonusAmt / grossSalary) * 100 : 0,    color: '#34d399' },
    { label: 'Overtime',          amount: overtimeAmt, pct: grossSalary > 0 ? (overtimeAmt / grossSalary) * 100 : 0, color: '#fbbf24' },
  ].filter(e => e.amount > 0);

  const deductions = [
    { label: 'Provident Fund',    amount: pfAmt,          pct: totalDeductions > 0 ? (pfAmt / totalDeductions) * 100 : 0,          color: '#f87171' },
    { label: 'Professional Tax',  amount: profTax,         pct: totalDeductions > 0 ? (profTax / totalDeductions) * 100 : 0,         color: '#fb923c' },
    { label: 'Income Tax',        amount: incomeTaxAmt,    pct: totalDeductions > 0 ? (incomeTaxAmt / totalDeductions) * 100 : 0,    color: '#f43f5e' },
    { label: 'Other Deductions',  amount: otherDed,        pct: totalDeductions > 0 ? (otherDed / totalDeductions) * 100 : 0,        color: '#a78bfa' },
  ].filter(d => d.amount > 0);

  const warnings = [];
  if (totalDeductions > grossSalary && grossSalary > 0) {
    warnings.push('Total deductions exceed gross salary. Net salary is negative.');
  }
  if (netSalary < 0) {
    warnings.push(`Net salary is negative: ${formatCurrency(netSalary)}`);
  }

  return {
    payPeriod,
    // Period values (as-entered)
    basicSalary: basic,
    hra: hraAmt,
    otherAllowances: allowances,
    bonus: bonusAmt,
    overtime: overtimeAmt,
    providentFund: pfAmt,
    professionalTax: profTax,
    incomeTax: incomeTaxAmt,
    otherDeductions: otherDed,
    // Computed
    grossSalary,
    totalDeductions,
    netSalary,
    deductionPct,
    // Annual equivalents
    annualGross,
    annualNet,
    annualDeductions,
    // Breakdowns
    earnings,
    deductions,
    warnings,
  };
}

/**
 * Validate salary inputs and return array of error messages.
 */
export function validateSalaryInputs(inputs) {
  const errors = [];
  const numeric = ['basicSalary','hra','otherAllowances','bonus','overtime',
                   'providentFund','professionalTax','incomeTax','otherDeductions'];
  for (const field of numeric) {
    const val = Number(inputs[field]);
    if (inputs[field] !== '' && inputs[field] !== undefined && (isNaN(val) || val < 0)) {
      errors.push(`${field}: must be a non-negative number`);
    }
  }
  if (!inputs.employeeName?.trim()) {
    errors.push('Employee name is required');
  }
  return errors;
}

/**
 * Generate a unique employee ID.
 */
export function generateEmployeeId(department = 'EMP') {
  const prefix = department.slice(0, 3).toUpperCase();
  const num = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${num}`;
}

/**
 * Generate a unique calculation ID.
 */
export function generateCalcId() {
  return `CALC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/**
 * Format a date string to a human-readable format.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Get the current pay period label.
 */
export function getPayPeriodLabel(period) {
  return period === 'annual' ? 'Annual' : 'Monthly';
}

/**
 * Summarize a list of salary calculations into payroll totals.
 */
export function summarizePayroll(calculations) {
  const totalGross = calculations.reduce((s, c) => s + (c.grossSalary || 0), 0);
  const totalNet   = calculations.reduce((s, c) => s + (c.netSalary || 0), 0);
  const totalDed   = calculations.reduce((s, c) => s + (c.totalDeductions || 0), 0);
  return { totalGross, totalNet, totalDed, count: calculations.length };
}

/**
 * Department colors for charts.
 */
export const DEPT_COLORS = [
  '#c8f135', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24',
  '#f87171', '#fb923c', '#f43f5e', '#38bdf8', '#818cf8',
];

/**
 * Get initials from a name string.
 */
export function getInitials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(n => n[0]?.toUpperCase()).join('');
}
