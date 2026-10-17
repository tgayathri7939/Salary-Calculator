import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import { getUserSettings, saveUserSettings, getDefaultSettings } from '../services/db.js';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState('dark');
  const [settings, setSettings] = useState(getDefaultSettings());
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load settings when user changes
  useEffect(() => {
    if (!user) {
      setTheme('dark');
      setSettings(getDefaultSettings());
      setSettingsLoaded(false);
      return;
    }
    getUserSettings(user.uid).then(s => {
      const merged = { ...getDefaultSettings(), ...s };
      setSettings(merged);
      setTheme(merged.theme || 'dark');
      setSettingsLoaded(true);
    }).catch(() => {
      setSettingsLoaded(true);
    });
  }, [user?.uid]);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (user) {
      const updated = { ...settings, theme: next };
      setSettings(updated);
      await saveUserSettings(user.uid, updated).catch(() => {});
    }
  }, [theme, settings, user]);

  const updateSettings = useCallback(async (updates) => {
    const updated = { ...settings, ...updates };
    setSettings(updated);
    if (updates.theme) setTheme(updates.theme);
    if (user) {
      await saveUserSettings(user.uid, updated);
    }
  }, [settings, user]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, settings, updateSettings, settingsLoaded }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
