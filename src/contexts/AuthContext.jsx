import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChange, logoutUser } from '../services/auth.js';
import { isFirebaseConfigured } from '../services/firebase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [isDemo, setIsDemo] = useState(!isFirebaseConfigured());

  useEffect(() => {
    let unsubscribe = () => {};

    onAuthStateChange((firebaseUser) => {
      setUser(firebaseUser);
      setIsDemo(!isFirebaseConfigured());
    }).then(unsub => {
      unsubscribe = unsub;
    }).catch(() => {
      setUser(null);
    });

    return () => unsubscribe();
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    if (!isFirebaseConfigured()) {
      setUser(null);
    }
  }, []);

  const loading = user === undefined;

  return (
    <AuthContext.Provider value={{ user, loading, isDemo, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
