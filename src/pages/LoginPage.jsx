import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { loginUser, registerUser, sendPasswordReset, getAuthErrorMessage } from '../services/auth.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { isFirebaseConfigured } from '../services/firebase.js';

const DEMO_CREDS = { email: 'demo@salaryflow.app', password: 'demo1234', name: 'Demo User' };

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, isDemo } = useAuth();
  const from = location.state?.from?.pathname || '/';

  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState({});

  function set(field) {
    return (e) => {
      setForm(f => ({ ...f, [field]: e.target.value }));
      setErrors(err => ({ ...err, [field]: '' }));
      setError('');
    };
  }

  function validate() {
    const errs = {};
    if (mode === 'register' && !form.name.trim()) errs.name = 'Full name is required.';
    if (!form.email.trim()) errs.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email address.';
    if (mode !== 'forgot') {
      if (!form.password) errs.password = 'Password is required.';
      else if (form.password.length < 6) errs.password = 'Password must be at least 6 characters.';
    }
    if (mode === 'register' && form.password !== form.confirm) {
      errs.confirm = 'Passwords do not match.';
    }
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'login') {
        const { user } = await loginUser(form.email, form.password);
        setUser(user);
        navigate(from, { replace: true });
      } else if (mode === 'register') {
        const { user } = await registerUser(form.email, form.password, form.name);
        setUser(user);
        navigate(from, { replace: true });
      } else {
        await sendPasswordReset(form.email);
        setSuccess(
          isFirebaseConfigured()
            ? 'Password reset email sent. Check your inbox.'
            : 'Demo mode: No email sent. Use any password to log in.'
        );
      }
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setLoading(true);
    setError('');
    try {
      // Ensure demo account exists
      const { registerUser: reg, loginUser: log } = await import('../services/auth.js');
      let user;
      try {
        const result = await log(DEMO_CREDS.email, DEMO_CREDS.password);
        user = result.user;
      } catch {
        const result = await reg(DEMO_CREDS.email, DEMO_CREDS.password, DEMO_CREDS.name);
        user = result.user;
      }
      setUser(user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to start demo session.');
    } finally {
      setLoading(false);
    }
  }

  const titles = {
    login:    { h: 'Welcome back',         sub: 'Sign in to your payroll workspace' },
    register: { h: 'Create your account',  sub: 'Start managing payroll intelligently' },
    forgot:   { h: 'Reset password',       sub: 'Enter your email to receive a reset link' },
  };

  return (
    <div className="login-layout">
      {/* ── Editorial Panel ── */}
      <div className="login-panel">
        <div className="login-panel-grid" aria-hidden="true" />

        <div className="login-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="logo-icon" style={{ width: 38, height: 38, fontSize: 22 }}>₹</div>
            <div>
              <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>SalaryFlow</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Payroll Intelligence</div>
            </div>
          </div>
        </div>

        <div className="login-headline">
          <div className="login-display">
            Payroll that<br />
            <em>thinks</em> for you.
          </div>
          <p className="login-tagline">
            Calculate, manage, and analyse salaries with editorial-grade clarity.
            Built for finance teams who demand precision and elegance.
          </p>

          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '⚡', text: 'Real-time salary calculations with Indian tax components' },
              { icon: '🔒', text: 'Firebase-secured data with per-user isolation' },
              { icon: '📊', text: 'Analytics, PDF exports, and department reporting' },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 15 }}>{f.icon}</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="login-stats" aria-label="Platform statistics">
          {[
            { value: '₹0', label: 'Setup Cost' },
            { value: '100%', label: 'Data Privacy' },
            { value: '∞', label: 'Calculations' },
          ].map((s, i) => (
            <div key={i}>
              <div className="login-stat-value">{s.value}</div>
              <div className="login-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Auth Form Panel ── */}
      <div className="login-form-panel">
        <div className="login-form-inner">
          <h1 className="login-form-title">{titles[mode].h}</h1>
          <p className="login-form-sub">{titles[mode].sub}</p>

          {!isFirebaseConfigured() && (
            <div className="demo-banner" style={{ marginBottom: 20 }}>
              <span>⚠</span>
              <span>
                <strong>Demo Mode</strong> — Firebase not configured.
                Data is stored in localStorage only. Not for production use.
              </span>
            </div>
          )}

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16 }} role="alert">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert alert-success" style={{ marginBottom: 16 }} role="status">
              <span>✓</span>
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-name">Full Name</label>
                <input
                  id="auth-name"
                  type="text"
                  className={`form-input ${errors.name ? 'error' : ''}`}
                  placeholder="Jane Doe"
                  value={form.name}
                  onChange={set('name')}
                  autoComplete="name"
                  required
                />
                {errors.name && <span className="form-error"><AlertCircle size={12} />{errors.name}</span>}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="auth-email">Email Address</label>
              <input
                id="auth-email"
                type="email"
                className={`form-input ${errors.email ? 'error' : ''}`}
                placeholder="you@company.com"
                value={form.email}
                onChange={set('email')}
                autoComplete={mode === 'register' ? 'email' : 'username'}
                required
              />
              {errors.email && <span className="form-error"><AlertCircle size={12} />{errors.email}</span>}
            </div>

            {mode !== 'forgot' && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-password">Password</label>
                <div className="input-wrapper">
                  <input
                    id="auth-password"
                    type={showPw ? 'text' : 'password'}
                    className={`form-input ${errors.password ? 'error' : ''}`}
                    placeholder={mode === 'register' ? 'Min. 6 characters' : '••••••••'}
                    value={form.password}
                    onChange={set('password')}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    required
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPw(p => !p)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <span className="form-error"><AlertCircle size={12} />{errors.password}</span>}
              </div>
            )}

            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-confirm">Confirm Password</label>
                <input
                  id="auth-confirm"
                  type="password"
                  className={`form-input ${errors.confirm ? 'error' : ''}`}
                  placeholder="Re-enter password"
                  value={form.confirm}
                  onChange={set('confirm')}
                  autoComplete="new-password"
                  required
                />
                {errors.confirm && <span className="form-error"><AlertCircle size={12} />{errors.confirm}</span>}
              </div>
            )}

            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-lime)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full"
              disabled={loading}
              id="auth-submit-btn"
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: 'var(--text-inverse)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  {mode === 'login' ? 'Signing in…' : mode === 'register' ? 'Creating account…' : 'Sending…'}
                </span>
              ) : (
                mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'
              )}
            </button>
          </form>

          {/* Mode switchers */}
          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            {mode === 'login' && (
              <>
                Don't have an account?{' '}
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--accent-lime)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
                  onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                  id="switch-to-register"
                >
                  Create one
                </button>
              </>
            )}
            {mode === 'register' && (
              <>
                Already have an account?{' '}
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--accent-lime)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  id="switch-to-login"
                >
                  Sign in
                </button>
              </>
            )}
            {mode === 'forgot' && (
              <button
                style={{ background: 'none', border: 'none', color: 'var(--accent-lime)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              >
                ← Back to sign in
              </button>
            )}
          </div>

          {/* Demo quick login */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
            <button
              className="btn btn-secondary w-full"
              onClick={handleDemoLogin}
              disabled={loading}
              id="demo-login-btn"
            >
              ⚡ Quick Demo Login
            </button>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
              Instant access with local demo data.{' '}
              <strong style={{ color: 'var(--accent-amber)' }}>Not secure</strong> — demo only.
            </p>
          </div>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    </div>
  );
}
