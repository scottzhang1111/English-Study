import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getAuthMe, loginAccount, logoutAccount } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const refreshAuth = useCallback(async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const payload = await getAuthMe();
      const nextAccount = payload?.account || null;
      setAccount(nextAccount);
      return nextAccount;
    } catch (err) {
      setAccount(null);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const login = useCallback(async (email) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const payload = await loginAccount({ email });
      const nextAccount = payload?.account || null;
      setAccount(nextAccount);
      return nextAccount;
    } catch (err) {
      setAuthError(err.message || 'Login failed');
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
      isAuthenticated: Boolean(account),
      refreshAuth,
      login,
      logout,
    }),
    [account, authLoading, authError, refreshAuth, login, logout],
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
