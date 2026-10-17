import { useState, useEffect } from 'react';
import {
  User, Bell, Palette, Download, Upload, Trash2, Save,
  Sun, Moon, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { updateDisplayName } from '../services/auth.js';
import { saveUserSettings, exportAllData, importData, clearAllData } from '../services/db.js';
import { isFirebaseConfigured } from '../services/firebase.js';

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={16} style={{ color: 'var(--accent-lime)' }} />
          </div>
          <div className="card-title">{title}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { user, setUser, isDemo } = useAuth();
  const { theme, toggleTheme, settings, updateSettings } = useTheme();
  const toast = useToast();

  const [profileForm, setProfileForm] = useState({ displayName: user?.displayName || '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [importConfirm, setImportConfirm] = useState(false);
  const [importData_, setImportData] = useState(null);
  const [localSettings, setLocalSettings] = useState({ ...settings });

  useEffect(() => { setLocalSettings({ ...settings }); }, [settings]);
  useEffect(() => { setProfileForm({ displayName: user?.displayName || '' }); }, [user]);

  async function handleSaveProfile() {
    if (!profileForm.displayName.trim()) { toast.error('Validation', 'Display name cannot be empty.'); return; }
    setSavingProfile(true);
    try {
      await updateDisplayName(profileForm.displayName);
      if (setUser && user) {
        setUser({ ...user, displayName: profileForm.displayName });
      }
      toast.success('Profile updated', 'Your display name has been saved.');
    } catch (err) {
      toast.error('Update failed', err.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveSettings() {
    try {
      await updateSettings(localSettings);
      toast.success('Settings saved', 'Your preferences have been updated.');
    } catch (err) {
      toast.error('Save failed', err.message);
    }
  }

  async function handleExport() {
    try {
      const data = await exportAllData(user.uid);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `salaryflow_backup_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export complete', 'Your data has been downloaded.');
    } catch (err) {
      toast.error('Export failed', err.message);
    }
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.employees && !parsed.salaryCalculations) {
          throw new Error('Invalid format: missing employees or salaryCalculations keys.');
        }
        setImportData(parsed);
        setImportConfirm(true);
      } catch (err) {
        toast.error('Invalid file', err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleConfirmImport() {
    try {
      await importData(user.uid, importData_);
      setImportConfirm(false);
      setImportData(null);
      toast.success('Import complete', `Imported ${importData_.employees?.length || 0} employees and ${importData_.salaryCalculations?.length || 0} calculations.`);
    } catch (err) {
      toast.error('Import failed', err.message);
    }
  }

  async function handleClearData() {
    try {
      await clearAllData(user.uid);
      setClearConfirm(false);
      toast.success('Data cleared', 'All application records have been removed.');
    } catch (err) {
      toast.error('Clear failed', err.message);
    }
  }

  function setLocalSetting(key) {
    return (e) => setLocalSettings(s => ({ ...s, [key]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your profile, preferences, and data</p>
        </div>
      </div>

      {isDemo && (
        <div className="demo-banner" style={{ marginBottom: 20 }}>
          <AlertTriangle size={15} />
          <span>
            <strong>Demo Mode</strong> — You are using localStorage-only storage.
            Settings and profile changes persist in your browser only. Configure Firebase for production.
          </span>
        </div>
      )}

      {/* Profile */}
      <Section title="Profile" icon={User}>
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="settings-display-name">Display Name</label>
            <input
              id="settings-display-name"
              className="form-input"
              value={profileForm.displayName}
              onChange={e => setProfileForm(p => ({ ...p, displayName: e.target.value }))}
              placeholder="Your full name"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email</label>
            <input className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button className="btn btn-primary btn-sm" onClick={handleSaveProfile} disabled={savingProfile} id="save-profile-btn">
            <Save size={13} /> {savingProfile ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance" icon={Palette}>
        <div className="form-group">
          <label className="form-label">Theme</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => theme !== 'dark' && toggleTheme()}
              id="theme-dark-btn"
            >
              <Moon size={14} /> Dark
            </button>
            <button
              className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => theme !== 'light' && toggleTheme()}
              id="theme-light-btn"
            >
              <Sun size={14} /> Light
            </button>
          </div>
        </div>
      </Section>

      {/* Payroll Defaults */}
      <Section title="Payroll Defaults" icon={Bell}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="settings-pay-period">Default Pay Period</label>
            <select id="settings-pay-period" className="form-select" value={localSettings.defaultPayPeriod} onChange={setLocalSetting('defaultPayPeriod')}>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="settings-currency">Currency</label>
            <select id="settings-currency" className="form-select" value={localSettings.currency} onChange={setLocalSetting('currency')}>
              <option value="INR">INR — Indian Rupee (₹)</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="settings-hra">Default HRA % (of Basic)</label>
            <div className="input-wrapper">
              <input id="settings-hra" type="number" min="0" max="100" className="form-input" value={localSettings.hraPercentage} onChange={setLocalSetting('hraPercentage')} />
              <span className="input-suffix">%</span>
            </div>
            <span className="form-hint">Used when "Use %" is enabled in the calculator.</span>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="settings-pf">Default PF % (of Basic)</label>
            <div className="input-wrapper">
              <input id="settings-pf" type="number" min="0" max="100" className="form-input" value={localSettings.pfPercentage} onChange={setLocalSetting('pfPercentage')} />
              <span className="input-suffix">%</span>
            </div>
            <span className="form-hint">Standard Provident Fund rate is 12%.</span>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleSaveSettings} id="save-settings-btn">
          <Save size={13} /> Save Settings
        </button>
      </Section>

      {/* Data Management */}
      <Section title="Data Management" icon={Download}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Export */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Export All Data</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Download all employees and salary records as JSON.</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleExport} id="export-all-btn">
              <Download size={13} /> Export JSON
            </button>
          </div>

          {/* Import */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Import Data</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Import from a previously exported JSON backup.</div>
            </div>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              <Upload size={13} /> Import JSON
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} id="import-file-input" />
            </label>
          </div>

          {/* Clear */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--accent-red)' }}>Clear All Data</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Permanently delete all employees, calculations, and activity logs.
              </div>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => setClearConfirm(true)} id="clear-data-btn">
              <Trash2 size={13} /> Clear Data
            </button>
          </div>
        </div>
      </Section>

      {/* Firebase Info */}
      <Section title="Firebase Configuration" icon={Bell}>
        <div className={`alert ${isFirebaseConfigured() ? 'alert-success' : 'alert-warning'}`}>
          <span>{isFirebaseConfigured() ? '●' : '⚠'}</span>
          <div>
            <div style={{ fontWeight: 600 }}>
              {isFirebaseConfigured() ? 'Firebase Connected' : 'Firebase Not Configured (Demo Mode)'}
            </div>
            <div style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.6 }}>
              {isFirebaseConfigured()
                ? 'Your data is securely stored in Cloud Firestore. Auth is handled by Firebase Authentication.'
                : 'Create a .env file from .env.example and add your Firebase project credentials to enable production mode.'
              }
            </div>
          </div>
        </div>
        {!isFirebaseConfigured() && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <strong>Setup steps:</strong>
            <ol style={{ paddingLeft: 20, marginTop: 8 }}>
              <li>Create a Firebase project at <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-lime)' }}>console.firebase.google.com</span></li>
              <li>Enable Email/Password authentication</li>
              <li>Create a Firestore database in production mode</li>
              <li>Copy your web app config values to <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-lime)' }}>.env</span></li>
              <li>Deploy Firestore security rules from <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-lime)' }}>firestore.rules</span></li>
            </ol>
          </div>
        )}
      </Section>

      {/* Confirm Clear */}
      {clearConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setClearConfirm(false)}>
          <div className="modal" role="alertdialog">
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--accent-red)' }}>Clear All Data</h2>
            </div>
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              <AlertTriangle size={15} />
              <span>This action is <strong>irreversible</strong>. All employees and salary records will be permanently deleted.</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Consider exporting your data first before clearing.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setClearConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleClearData} id="confirm-clear-btn">
                <Trash2 size={14} /> Yes, Clear Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Import */}
      {importConfirm && importData_ && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setImportConfirm(false)}>
          <div className="modal" role="dialog">
            <div className="modal-header">
              <h2 className="modal-title">Confirm Import</h2>
            </div>
            <div className="alert alert-warning" style={{ marginBottom: 16 }}>
              <AlertTriangle size={15} />
              <span>This will <strong>add</strong> records from the backup file. Existing data will not be removed.</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Found: <strong>{importData_.employees?.length || 0}</strong> employees and{' '}
              <strong>{importData_.salaryCalculations?.length || 0}</strong> calculations in the backup.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setImportConfirm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmImport} id="confirm-import-btn">
                <Upload size={14} /> Import Data
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
