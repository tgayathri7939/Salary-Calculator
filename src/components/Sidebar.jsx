import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calculator, Users, History,
  BarChart3, Settings, LogOut, ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { getInitials } from '../utils/salaryCalc.js';

const NAV_ITEMS = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard'   },
  { to: '/calculator', icon: Calculator,      label: 'Calculator'  },
  { to: '/employees',  icon: Users,           label: 'Employees'   },
  { to: '/history',    icon: History,         label: 'History'     },
  { to: '/reports',    icon: BarChart3,       label: 'Reports'     },
  { to: '/settings',   icon: Settings,        label: 'Settings'    },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout, isDemo } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = user?.displayName || user?.email || 'User';
  const initials = getInitials(displayName);

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${open ? 'open' : ''}`}
        onClick={onClose}
      />

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <div className="logo-icon">₹</div>
            <div className="logo-text">
              <span className="logo-name">SalaryFlow</span>
              <span className="logo-tagline">Payroll Intelligence</span>
            </div>
          </div>
          {isDemo && (
            <div style={{
              marginTop: 10,
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.25)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 10,
              color: 'var(--accent-amber)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.06em',
            }}>
              ⚠ DEMO MODE — localStorage only
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav" role="navigation" aria-label="Main navigation">
          <span className="nav-section-label">Navigation</span>
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-card" onClick={() => { navigate('/settings'); onClose?.(); }}>
            <div className="user-avatar" aria-hidden="true">{initials}</div>
            <div className="user-info">
              <div className="user-name">{displayName}</div>
              <div className="user-role">{isDemo ? 'Demo Account' : 'Admin'}</div>
            </div>
            <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>
          <button
            className="btn btn-ghost btn-sm w-full mt-2"
            style={{ justifyContent: 'flex-start', gap: 8 }}
            onClick={handleLogout}
            id="sidebar-logout-btn"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
