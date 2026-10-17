/**
 * Database Service — Employees, Salary Calculations, Activity Logs
 * 
 * Dual-mode: Firestore (when configured) or localStorage (demo mode).
 * 
 * Data Model:
 *   users/{uid}/profile
 *   users/{uid}/employees/{empId}
 *   users/{uid}/salaryCalculations/{calcId}
 *   users/{uid}/activityLogs/{logId}
 * 
 * Every record is scoped to the authenticated user's uid.
 * Firestore security rules MUST enforce ownership; frontend filtering is NOT sufficient.
 */

import { isFirebaseConfigured, getFirebaseServices } from './firebase.js';

// ─── LocalStorage Demo Helpers ───────────────────────────────────────────────

const LS_KEYS = {
  employees:    uid => `sf_employees_${uid}`,
  calcs:        uid => `sf_calcs_${uid}`,
  activity:     uid => `sf_activity_${uid}`,
  profile:      uid => `sf_profile_${uid}`,
};

function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}

function lsGetObj(key, def = {}) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); }
  catch { return def; }
}

function lsSet(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function newId(prefix = 'doc') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function now() { return new Date().toISOString(); }

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getUserProfile(uid) {
  if (isFirebaseConfigured()) {
    const { db } = await getFirebaseServices();
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  }
  return lsGetObj(LS_KEYS.profile(uid), null);
}

export async function saveUserProfile(uid, profile) {
  if (isFirebaseConfigured()) {
    const { db } = await getFirebaseServices();
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'users', uid), { ...profile, uid, updatedAt: now() }, { merge: true });
    return;
  }
  lsSet(LS_KEYS.profile(uid), { ...profile, uid, updatedAt: now() });
}

// ─── Employees ───────────────────────────────────────────────────────────────

export async function getEmployees(uid) {
  if (isFirebaseConfigured()) {
    const { db } = await getFirebaseServices();
    const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
    const q = query(
      collection(db, 'users', uid, 'employees'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  return lsGet(LS_KEYS.employees(uid)).sort((a, b) => b.createdAt?.localeCompare?.(a.createdAt) || 0);
}

export async function addEmployee(uid, employee) {
  const id = employee.id || newId('emp');
  const record = {
    ...employee,
    id,
    uid,
    createdAt: now(),
    updatedAt: now(),
  };
  if (isFirebaseConfigured()) {
    const { db } = await getFirebaseServices();
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'users', uid, 'employees', id), record);
    await logActivity(uid, 'employee_added', `Added employee: ${employee.name}`, { employeeId: id });
    return record;
  }
  const list = lsGet(LS_KEYS.employees(uid));
  list.unshift(record);
  lsSet(LS_KEYS.employees(uid), list);
  await logActivity(uid, 'employee_added', `Added employee: ${employee.name}`, { employeeId: id });
  return record;
}

export async function updateEmployee(uid, employeeId, updates) {
  const updatedAt = now();
  if (isFirebaseConfigured()) {
    const { db } = await getFirebaseServices();
    const { doc, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'users', uid, 'employees', employeeId), { ...updates, updatedAt });
    await logActivity(uid, 'employee_updated', `Updated employee: ${updates.name || employeeId}`, { employeeId });
    return;
  }
  const list = lsGet(LS_KEYS.employees(uid));
  const idx = list.findIndex(e => e.id === employeeId);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates, updatedAt };
    lsSet(LS_KEYS.employees(uid), list);
  }
  await logActivity(uid, 'employee_updated', `Updated employee: ${updates.name || employeeId}`, { employeeId });
}

export async function deleteEmployee(uid, employeeId) {
  if (isFirebaseConfigured()) {
    const { db } = await getFirebaseServices();
    const { doc, deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'users', uid, 'employees', employeeId));
    await logActivity(uid, 'employee_deleted', `Deleted employee: ${employeeId}`, { employeeId });
    return;
  }
  const list = lsGet(LS_KEYS.employees(uid)).filter(e => e.id !== employeeId);
  lsSet(LS_KEYS.employees(uid), list);
  await logActivity(uid, 'employee_deleted', `Deleted employee: ${employeeId}`, { employeeId });
}

// ─── Salary Calculations ─────────────────────────────────────────────────────

export async function getSalaryCalculations(uid) {
  if (isFirebaseConfigured()) {
    const { db } = await getFirebaseServices();
    const { collection, query, orderBy, getDocs } = await import('firebase/firestore');
    const q = query(
      collection(db, 'users', uid, 'salaryCalculations'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  return lsGet(LS_KEYS.calcs(uid)).sort((a, b) => b.createdAt?.localeCompare?.(a.createdAt) || 0);
}

export async function saveSalaryCalculation(uid, calc) {
  const id = calc.id || newId('calc');
  const record = {
    ...calc,
    id,
    uid,
    createdAt: calc.createdAt || now(),
    updatedAt: now(),
  };
  if (isFirebaseConfigured()) {
    const { db } = await getFirebaseServices();
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'users', uid, 'salaryCalculations', id), record);
    await logActivity(uid, 'calc_saved', `Saved calculation for ${calc.employeeName}`, { calcId: id });
    return record;
  }
  const list = lsGet(LS_KEYS.calcs(uid));
  const idx = list.findIndex(c => c.id === id);
  if (idx !== -1) {
    list[idx] = record;
  } else {
    list.unshift(record);
  }
  lsSet(LS_KEYS.calcs(uid), list);
  await logActivity(uid, 'calc_saved', `Saved calculation for ${calc.employeeName}`, { calcId: id });
  return record;
}

export async function updateSalaryCalculation(uid, calcId, updates) {
  const updatedAt = now();
  if (isFirebaseConfigured()) {
    const { db } = await getFirebaseServices();
    const { doc, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'users', uid, 'salaryCalculations', calcId), { ...updates, updatedAt });
    await logActivity(uid, 'calc_updated', `Updated calculation: ${calcId}`, { calcId });
    return;
  }
  const list = lsGet(LS_KEYS.calcs(uid));
  const idx = list.findIndex(c => c.id === calcId);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates, updatedAt };
    lsSet(LS_KEYS.calcs(uid), list);
  }
  await logActivity(uid, 'calc_updated', `Updated calculation: ${calcId}`, { calcId });
}

export async function deleteSalaryCalculation(uid, calcId) {
  if (isFirebaseConfigured()) {
    const { db } = await getFirebaseServices();
    const { doc, deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'users', uid, 'salaryCalculations', calcId));
    await logActivity(uid, 'calc_deleted', `Deleted calculation: ${calcId}`, { calcId });
    return;
  }
  const list = lsGet(LS_KEYS.calcs(uid)).filter(c => c.id !== calcId);
  lsSet(LS_KEYS.calcs(uid), list);
  await logActivity(uid, 'calc_deleted', `Deleted calculation: ${calcId}`, { calcId });
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export async function logActivity(uid, type, message, meta = {}) {
  const id = newId('log');
  const record = { id, uid, type, message, meta, createdAt: now() };
  if (isFirebaseConfigured()) {
    const { db } = await getFirebaseServices();
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'users', uid, 'activityLogs', id), record);
    return;
  }
  const list = lsGet(LS_KEYS.activity(uid));
  list.unshift(record);
  // Keep last 100 activity items
  lsSet(LS_KEYS.activity(uid), list.slice(0, 100));
}

export async function getActivityLogs(uid, limit = 20) {
  if (isFirebaseConfigured()) {
    const { db } = await getFirebaseServices();
    const { collection, query, orderBy, limitQuery, getDocs } = await import('firebase/firestore');
    const q = query(
      collection(db, 'users', uid, 'activityLogs'),
      orderBy('createdAt', 'desc'),
      limitQuery(limit)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  return lsGet(LS_KEYS.activity(uid)).slice(0, limit);
}

// ─── Data Export / Import ────────────────────────────────────────────────────

export async function exportAllData(uid) {
  const [employees, calcs, activity] = await Promise.all([
    getEmployees(uid),
    getSalaryCalculations(uid),
    getActivityLogs(uid, 200),
  ]);
  return {
    exportedAt: now(),
    uid,
    employees,
    salaryCalculations: calcs,
    activityLogs: activity,
  };
}

export async function importData(uid, data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid import data format.');
  const { employees = [], salaryCalculations = [] } = data;

  // Import employees
  for (const emp of employees) {
    await addEmployee(uid, { ...emp, id: newId('emp') });
  }

  // Import calculations
  for (const calc of salaryCalculations) {
    await saveSalaryCalculation(uid, { ...calc, id: newId('calc') });
  }

  await logActivity(uid, 'data_imported', `Imported ${employees.length} employees and ${salaryCalculations.length} calculations.`);
}

export async function clearAllData(uid) {
  if (isFirebaseConfigured()) {
    const { db } = await getFirebaseServices();
    const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');

    for (const col of ['employees', 'salaryCalculations', 'activityLogs']) {
      const snap = await getDocs(collection(db, 'users', uid, col));
      await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'users', uid, col, d.id))));
    }
    return;
  }
  lsSet(LS_KEYS.employees(uid), []);
  lsSet(LS_KEYS.calcs(uid), []);
  lsSet(LS_KEYS.activity(uid), []);
}

// ─── User Settings ────────────────────────────────────────────────────────────

export async function getUserSettings(uid) {
  if (isFirebaseConfigured()) {
    const { db } = await getFirebaseServices();
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'users', uid, 'settings', 'prefs'));
    return snap.exists() ? snap.data() : getDefaultSettings();
  }
  return lsGetObj(`sf_settings_${uid}`, getDefaultSettings());
}

export async function saveUserSettings(uid, settings) {
  if (isFirebaseConfigured()) {
    const { db } = await getFirebaseServices();
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'users', uid, 'settings', 'prefs'), { ...settings, updatedAt: now() }, { merge: true });
    return;
  }
  lsSet(`sf_settings_${uid}`, { ...settings, updatedAt: now() });
}

export function getDefaultSettings() {
  return {
    currency: 'INR',
    defaultPayPeriod: 'monthly',
    hraPercentage: 40,
    pfPercentage: 12,
    theme: 'dark',
  };
}
