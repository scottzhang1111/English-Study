import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getAuthMe, loginAccount, logoutAccount } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authExpired, setAuthExpired] = useState(false);
  const [authChildren, setAuthChildren] = useState([]);

  const refreshAuth = useCallback(async () => {
    setAuthExpired(false);
    setAuthLoading(true);
    setAuthError('');
    try {
      const payload = await getAuthMe();
      const nextAccount = payload?.account || null;
      setAccount(nextAccount);
      setAuthChildren(Array.isArray(payload?.children) ? payload.children : []);
      return nextAccount;
    } catch (err) {
      if (err?.status === 401) {
        setAuthExpired(true);
        setAuthError('');
      } else {
        setAuthExpired(false);
        setAuthError(err.message || 'ログイン状態を確認できませんでした');
      }
      setAuthChildren([]);
      setAccount(null);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const login = useCallback(async (credentials) => {
    setAuthLoading(true);
    setAuthError('');
    setAuthExpired(false);
    try {
      const payload = await loginAccount(
        typeof credentials === 'string' ? { email: credentials } : credentials,
      );
      const nextAccount = payload?.account || null;
      setAccount(nextAccount);
      setAuthChildren(Array.isArray(payload?.children) ? payload.children : []);
      return nextAccount;
    } catch (err) {
      setAuthError(err.message || 'Login failed');
      setAuthChildren([]);
      setAccount(null);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      await logoutAccount();
    } finally {
      setAccount(null);
      setAuthChildren([]);
      setAuthExpired(false);
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const value = useMemo(
    () => ({
      account,
      authLoading,
      authError,
      authExpired,
      authChildren,
      isAuthenticated: Boolean(account),
      refreshAuth,
      login,
      logout,
    }),
    [account, authLoading, authError, authExpired, authChildren, refreshAuth, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
