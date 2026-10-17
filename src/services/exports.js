/**
 * Export Service — PDF, CSV generation for salary statements, employee records, etc.
 */

import { formatCurrency, formatDate, getPayPeriodLabel } from '../utils/salaryCalc.js';

// ─── CSV ────────────────────────────────────────────────────────────────────

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCSV(row) {
  return row.map(escapeCSV).join(',');
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 60);
}

export function exportEmployeesCSV(employees) {
  const headers = ['Employee ID','Name','Email','Department','Job Title','Status','Joining Date','Created At'];
  const rows = employees.map(e => [
    e.employeeId || e.id,
    e.name,
    e.email,
    e.department,
    e.jobTitle,
    e.status,
    formatDate(e.joiningDate),
    formatDate(e.createdAt),
  ]);
  const csv = [headers, ...rows].map(rowToCSV).join('\n');
  downloadBlob(csv, `salaryflow_employees_${Date.now()}.csv`, 'text/csv');
}

export function exportCalculationsCSV(calculations) {
  const headers = [
    'Calc ID','Employee ID','Employee Name','Department','Pay Period',
    'Basic Salary','HRA','Allowances','Bonus','Overtime',
    'Gross Salary','PF','Prof Tax','Income Tax','Other Deductions',
    'Total Deductions','Net Salary','Date',
  ];
  const rows = calculations.map(c => [
    c.id,
    c.employeeId || '',
    c.employeeName || '',
    c.department || '',
    getPayPeriodLabel(c.payPeriod),
    c.basicSalary,
    c.hra,
    c.otherAllowances,
    c.bonus,
    c.overtime,
    c.grossSalary,
    c.providentFund,
    c.professionalTax,
    c.incomeTax,
    c.otherDeductions,
    c.totalDeductions,
    c.netSalary,
    formatDate(c.createdAt),
  ]);
  const csv = [headers, ...rows].map(rowToCSV).join('\n');
  downloadBlob(csv, `salaryflow_history_${Date.now()}.csv`, 'text/csv');
}

export function exportSingleCalculationCSV(calc) {
  const rows = [
    ['SalaryFlow — Salary Statement'],
    ['DISCLAIMER: Illustrative calculation only. Not official tax advice.'],
    [],
    ['Employee Name', calc.employeeName || ''],
    ['Employee ID',   calc.employeeId  || ''],
    ['Department',    calc.department  || ''],
    ['Job Title',     calc.jobTitle    || ''],
    ['Pay Period',    getPayPeriodLabel(calc.payPeriod)],
    ['Generated',     formatDate(new Date().toISOString())],
    [],
    ['EARNINGS'],
    ['Basic Salary',     formatCurrency(calc.basicSalary)],
    ['HRA',              formatCurrency(calc.hra)],
    ['Other Allowances', formatCurrency(calc.otherAllowances)],
    ['Bonus',            formatCurrency(calc.bonus)],
    ['Overtime',         formatCurrency(calc.overtime)],
    ['Gross Salary',     formatCurrency(calc.grossSalary)],
    [],
    ['DEDUCTIONS'],
    ['Provident Fund',   formatCurrency(calc.providentFund)],
    ['Professional Tax', formatCurrency(calc.professionalTax)],
    ['Income Tax',       formatCurrency(calc.incomeTax)],
    ['Other Deductions', formatCurrency(calc.otherDeductions)],
    ['Total Deductions', formatCurrency(calc.totalDeductions)],
    [],
    ['NET SALARY',       formatCurrency(calc.netSalary)],
  ];
  const csv = rows.map(rowToCSV).join('\n');
  const name = safeFilename(calc.employeeName || 'salary');
  downloadBlob(csv, `salary_statement_${name}_${Date.now()}.csv`, 'text/csv');
}

export function exportReportCSV(title, headers, rows) {
  const csv = [
    [title],
    [`Generated: ${new Date().toLocaleDateString('en-IN')}`],
    [],
    headers,
    ...rows,
  ].map(rowToCSV).join('\n');
  downloadBlob(csv, `salaryflow_report_${Date.now()}.csv`, 'text/csv');
}

// ─── PDF ────────────────────────────────────────────────────────────────────

export async function exportSalaryStatementPDF(calc) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  // Dark header band
  doc.setFillColor(15, 15, 17);
  doc.rect(0, 0, W, 40, 'F');

  // App name
  doc.setTextColor(200, 241, 53);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SalaryFlow', 14, 16);

  doc.setTextColor(153, 152, 160);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('PAYROLL INTELLIGENCE', 14, 22);

  doc.setTextColor(240, 237, 232);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('SALARY STATEMENT', W - 14, 16, { align: 'right' });

  doc.setTextColor(153, 152, 160);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(getPayPeriodLabel(calc.payPeriod) + ' Pay Period', W - 14, 22, { align: 'right' });

  // Disclaimer
  doc.setFillColor(251, 191, 36, 20);
  doc.setDrawColor(251, 191, 36);
  doc.setTextColor(100, 80, 0);
  doc.setFontSize(7.5);
  doc.text('DISCLAIMER: Illustrative calculation only. Not official tax advice.', 14, 31);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, W - 14, 31, { align: 'right' });

  // Employee info
  let y = 50;
  doc.setTextColor(50, 50, 60);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPLOYEE DETAILS', 14, y);
  y += 7;

  const empDetails = [
    ['Name',       calc.employeeName || '—'],
    ['Employee ID',calc.employeeId   || '—'],
    ['Department', calc.department   || '—'],
    ['Job Title',  calc.jobTitle     || '—'],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: empDetails,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40, textColor: [100, 100, 120] }, 1: { textColor: [30, 30, 40] } },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 60);
  doc.text('EARNINGS', 14, y);

  autoTable(doc, {
    startY: y + 4,
    head: [['Component', 'Amount']],
    body: [
      ['Basic Salary',     formatCurrency(calc.basicSalary)],
      ['HRA',              formatCurrency(calc.hra)],
      ['Other Allowances', formatCurrency(calc.otherAllowances)],
      ['Bonus',            formatCurrency(calc.bonus)],
      ['Overtime',         formatCurrency(calc.overtime)],
      ['', ''],
      ['GROSS SALARY',     formatCurrency(calc.grossSalary)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 15, 17], textColor: [200, 241, 53], fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'normal' } },
    bodyStyles: { textColor: [40, 40, 50] },
    didDrawCell: (data) => {
      if (data.row.index === 6) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 255, 200];
      }
    },
    margin: { left: 14, right: W / 2 + 2 },
  });

  const earningsY = doc.lastAutoTable.finalY;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 60);
  doc.text('DEDUCTIONS', W / 2 + 2, y);

  autoTable(doc, {
    startY: y + 4,
    head: [['Component', 'Amount']],
    body: [
      ['Provident Fund',   formatCurrency(calc.providentFund)],
      ['Professional Tax', formatCurrency(calc.professionalTax)],
      ['Income Tax',       formatCurrency(calc.incomeTax)],
      ['Other Deductions', formatCurrency(calc.otherDeductions)],
      ['', ''],
      ['TOTAL DEDUCTIONS', formatCurrency(calc.totalDeductions)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [40, 15, 15], textColor: [248, 113, 113], fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right' } },
    bodyStyles: { textColor: [40, 40, 50] },
    margin: { left: W / 2 + 2, right: 14 },
  });

  const deductionsY = doc.lastAutoTable.finalY;
  y = Math.max(earningsY, deductionsY) + 10;

  // Net salary box
  doc.setFillColor(15, 15, 17);
  doc.roundedRect(14, y, W - 28, 22, 3, 3, 'F');
  doc.setTextColor(153, 152, 160);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('NET SALARY', 22, y + 9);
  doc.setTextColor(200, 241, 53);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(calc.netSalary), W - 22, y + 13, { align: 'right' });

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(153, 152, 160);
  doc.text('SalaryFlow — Payroll Intelligence | salaryflow.app', 14, doc.internal.pageSize.getHeight() - 8);
  doc.text(new Date().toLocaleDateString('en-IN'), W - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });

  const name = (calc.employeeName || 'salary').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`salary_statement_${name}_${Date.now()}.pdf`);
}

export async function exportEmployeesPDF(employees) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 15, 17);
  doc.rect(0, 0, W, 20, 'F');
  doc.setTextColor(200, 241, 53);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SalaryFlow — Employee Directory', 14, 13);
  doc.setTextColor(153, 152, 160);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, W - 14, 13, { align: 'right' });

  autoTable(doc, {
    startY: 26,
    head: [['Employee ID', 'Name', 'Email', 'Department', 'Job Title', 'Status', 'Joining Date']],
    body: employees.map(e => [
      e.employeeId || e.id,
      e.name,
      e.email,
      e.department,
      e.jobTitle,
      e.status,
      formatDate(e.joiningDate),
    ]),
    headStyles: { fillColor: [15, 15, 17], textColor: [200, 241, 53] },
    styles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: [245, 245, 248] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`salaryflow_employees_${Date.now()}.pdf`);
}
