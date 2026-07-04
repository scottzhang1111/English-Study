import { Navigate } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import { useChildren } from '../ChildrenContext';
import { useAuth } from '../AuthContext';

export default function StartupGate() {
  const { authLoading, authError, authExpired, isAuthenticated, refreshAuth } = useAuth();
  const { children, childrenLoading, childrenError, selectedChildId, refreshChildren } = useChildren();

  if (authLoading || childrenLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm font-bold text-[#6f7da8]">ログイン状態を確認しています...</div>;
  }

  if (!isAuthenticated) {
    if (authError && !authExpired) {
      return (
        <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm font-bold text-rose-700">
          <p>{authError}</p>
          <button type="button" onClick={refreshAuth} className="pill-button mt-4 px-5 py-3 text-sm">
            Retry
          </button>
        </div>
      );
    }
    return authExpired ? (
      <Navigate replace to="/parent-login" state={{ message: '保護者の再ログインが必要です' }} />
    ) : (
      <Navigate replace to="/onboarding" />
    );
  }

  if (childrenError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm font-bold text-rose-700">
        <p>{childrenError}</p>
        <button type="button" onClick={refreshChildren} className="pill-button mt-4 px-5 py-3 text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (children.length === 0) {
    return <Navigate replace to="/create-child-profile" />;
  }

  if (selectedChildId && children.some((child) => String(child.id) === String(selectedChildId))) {
    return <HomePage />;
  }

  return <Navigate replace to="/select-child" />;
}

export function RequireCurrentChild({ children }) {
  const { authLoading, authError, authExpired, isAuthenticated, refreshAuth } = useAuth();
  const { children: childList, childrenLoading, childrenError, selectedChildId, refreshChildren } = useChildren();
  const selectedExists = childList.some((child) => String(child.id) === String(selectedChildId));

  if (authLoading || childrenLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm font-bold text-[#6f7da8]">ログイン状態を確認しています...</div>;
  }

  if (!isAuthenticated) {
    if (authError && !authExpired) {
      return (
        <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm font-bold text-rose-700">
          <p>{authError}</p>
          <button type="button" onClick={refreshAuth} className="pill-button mt-4 px-5 py-3 text-sm">
            Retry
          </button>
        </div>
      );
    }
    return <Navigate replace to="/onboarding" />;
  }

  if (childrenError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm font-bold text-rose-700">
        <p>{childrenError}</p>
        <button type="button" onClick={refreshChildren} className="pill-button mt-4 px-5 py-3 text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (childList.length === 0) {
    return <Navigate replace to="/create-child-profile" />;
  }

  return selectedChildId && selectedExists ? children : <Navigate replace to="/select-child" />;
}
