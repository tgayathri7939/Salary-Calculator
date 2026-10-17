import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Sun, Moon, Menu, ChevronRight, User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { getInitials } from '../utils/salaryCalc.js';

const BREADCRUMBS = {
  '/':           'Dashboard',
  '/calculator': 'Salary Calculator',
  '/employees':  'Employee Management',
  '/history':    'Salary History',
  '/reports':    'Reports & Analytics',
  '/settings':   'Settings',
  '/profile':    'Profile',
};

export default function TopHeader({ onMenuToggle, currentPath }) {
  const { user, logout, isDemo } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const pageName = Object.entries(BREADCRUMBS).find(([path]) =>
    path === '/' ? currentPath === '/' : currentPath.startsWith(path)
  )?.[1] || 'SalaryFlow';

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setShowProfile(false);
    await logout();
    navigate('/login');
  };

  const displayName = user?.displayName || user?.email || 'User';
  const initials = getInitials(displayName);

  const notifications = [
    { title: 'Salary calculated successfully', time: 'Just now', icon: '✓' },
    { title: 'New employee added', time: '2 min ago', icon: '+' },
    { title: isDemo ? 'Running in Demo Mode' : 'Firebase connected', time: 'Session', icon: isDemo ? '⚠' : '●' },
  ];

  return (
    <header className="top-header" role="banner">
      <div className="header-left">
        <button
          className="mobile-menu-btn"
          onClick={onMenuToggle}
          aria-label="Toggle navigation menu"
          id="mobile-menu-toggle"
        >
          <Menu size={18} />
        </button>
        <nav className="header-breadcrumb" aria-label="Breadcrumb">
          <span>SalaryFlow</span>
          <ChevronRight size={12} aria-hidden="true" />
          <span className="current" aria-current="page">{pageName}</span>
        </nav>
      </div>

      <div className="header-right">
        {/* Theme toggle */}
        <button
          className="header-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          id="theme-toggle-btn"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            className="header-btn"
            onClick={() => { setShowNotif(p => !p); setShowProfile(false); }}
            aria-label="Notifications"
            aria-expanded={showNotif}
            id="notifications-btn"
          >
            <Bell size={16} />
            <span className="notification-badge" aria-label="New notifications" />
          </button>

          {showNotif && (
            <div className="notif-panel" role="dialog" aria-label="Notifications">
              <div className="notif-header">
                <span>Notifications</span>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--accent-lime)', cursor: 'pointer', fontSize: 12 }}
                  onClick={() => setShowNotif(false)}
                >
                  Mark all read
                </button>
              </div>
              <div className="notif-list">
                {notifications.map((n, i) => (
                  <div key={i} className="notif-item">
                    <div className="notif-title">
                      <span style={{ marginRight: 6, opacity: 0.7 }}>{n.icon}</span>
                      {n.title}
                    </div>
                    <div className="notif-time">{n.time}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile menu */}
        <div className="relative" ref={profileRef}>
          <button
            className="header-btn"
            onClick={() => { setShowProfile(p => !p); setShowNotif(false); }}
            aria-label="Profile menu"
            aria-expanded={showProfile}
            id="profile-menu-btn"
            style={{ width: 'auto', padding: '4px 8px', gap: 8, borderRadius: 'var(--radius-md)' }}
          >
            <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{initials}</div>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName.split(' ')[0]}
            </span>
          </button>

          {showProfile && (
            <div className="dropdown-menu" role="menu">
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{displayName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{user?.email}</div>
              </div>
              <button className="dropdown-item" role="menuitem" onClick={() => { navigate('/settings'); setShowProfile(false); }}>
                <User size={14} />
                Profile Settings
              </button>
              <button className="dropdown-item" role="menuitem" onClick={() => { navigate('/settings'); setShowProfile(false); }}>
                <Settings size={14} />
                Preferences
              </button>
              <div className="dropdown-divider" />
              <button className="dropdown-item danger" role="menuitem" onClick={handleLogout} id="header-logout-btn">
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
