/**
 * Authentication Service
 * 
 * Supports two modes:
 * 1. Firebase Auth — when VITE_FIREBASE_* env vars are configured.
 * 2. Demo Mode    — localStorage-based, clearly labelled, no password storage.
 * 
 * IMPORTANT: Demo mode is NOT secure and must never be presented as such.
 * Passwords are never stored in demo mode — only a flag that the user is logged in.
 */

import { isFirebaseConfigured, getFirebaseServices } from './firebase.js';

const DEMO_USER_KEY = 'sf_demo_user';

// ─── Demo Mode Helpers ───────────────────────────────────────────────────────

function getDemoUser() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_USER_KEY) || 'null');
  } catch {
    return null;
  }
}

function setDemoUser(user) {
  localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
}

function clearDemoUser() {
  localStorage.removeItem(DEMO_USER_KEY);
}

function makeDemoUser(name, email) {
  return {
    uid: `demo-${Date.now()}`,
    displayName: name,
    email,
    isDemo: true,
    createdAt: new Date().toISOString(),
  };
}

// Registered demo accounts (stored without password — just profile info)
const DEMO_ACCOUNTS_KEY = 'sf_demo_accounts';

function getDemoAccounts() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_ACCOUNTS_KEY) || '{}');
  } catch { return {}; }
}

function saveDemoAccount(email, displayName) {
  const accounts = getDemoAccounts();
  accounts[email.toLowerCase()] = { displayName, email: email.toLowerCase() };
  localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(accounts));
}

// ─── Auth Service ─────────────────────────────────────────────────────────────

/**
 * Register a new user.
 * @returns {{ user, isDemo }}
 */
export async function registerUser(email, password, displayName) {
  if (isFirebaseConfigured()) {
    const { auth } = await getFirebaseServices();
    const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName });
    return { user: credential.user, isDemo: false };
  }

  // Demo mode — no password stored
  const accounts = getDemoAccounts();
  if (accounts[email.toLowerCase()]) {
    throw new Error('An account with this email already exists in demo mode.');
  }
  saveDemoAccount(email, displayName);
  const user = makeDemoUser(displayName, email);
  setDemoUser(user);
  return { user, isDemo: true };
}

/**
 * Sign in an existing user.
 */
export async function loginUser(email, password) {
  if (isFirebaseConfigured()) {
    const { auth } = await getFirebaseServices();
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return { user: credential.user, isDemo: false };
  }

  // Demo mode — accept any password for any registered account
  const accounts = getDemoAccounts();
  const account = accounts[email.toLowerCase()];
  if (!account) {
    throw new Error('No demo account found for this email. Please register first.');
  }
  const user = makeDemoUser(account.displayName, email);
  setDemoUser(user);
  return { user, isDemo: true };
}

/**
 * Send a password reset email.
 */
export async function sendPasswordReset(email) {
  if (isFirebaseConfigured()) {
    const { auth } = await getFirebaseServices();
    const { sendPasswordResetEmail } = await import('firebase/auth');
    await sendPasswordResetEmail(auth, email);
    return;
  }
  // Demo mode — simulate success
  await new Promise(r => setTimeout(r, 800));
  // (No actual email sent in demo)
}

/**
 * Sign out the current user.
 */
export async function logoutUser() {
  if (isFirebaseConfigured()) {
    const { auth } = await getFirebaseServices();
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
    return;
  }
  clearDemoUser();
}

/**
 * Update user display name.
 */
export async function updateDisplayName(displayName) {
  if (isFirebaseConfigured()) {
    const { auth } = await getFirebaseServices();
    const { updateProfile } = await import('firebase/auth');
    await updateProfile(auth.currentUser, { displayName });
    return;
  }
  const user = getDemoUser();
  if (user) {
    user.displayName = displayName;
    setDemoUser(user);
  }
}

/**
 * Get the current authenticated user synchronously (from cache/localStorage).
 * Returns null if not authenticated.
 */
export function getCurrentUserSync() {
  if (!isFirebaseConfigured()) {
    return getDemoUser();
  }
  // Firebase auth state is async; use the AuthContext for reactive state.
  return null;
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 */
export async function onAuthStateChange(callback) {
  if (isFirebaseConfigured()) {
    const { auth } = await getFirebaseServices();
    const { onAuthStateChanged } = await import('firebase/auth');
    return onAuthStateChanged(auth, callback);
  }

  // Demo mode — immediately emit current user, then no further changes.
  const user = getDemoUser();
  callback(user);
  // Return no-op unsubscribe
  return () => {};
}

/**
 * Translate Firebase auth error codes to user-friendly messages.
 */
export function getAuthErrorMessage(error) {
  const code = error?.code || '';
  const map = {
    'auth/email-already-in-use':   'An account with this email already exists.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/user-not-found':         'No account found with this email address.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/too-many-requests':      'Too many failed attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
    'auth/popup-closed-by-user':   'Sign-in popup was closed. Please try again.',
    'auth/invalid-credential':     'Invalid email or password.',
  };
  return map[code] || error?.message || 'An unexpected error occurred.';
}
