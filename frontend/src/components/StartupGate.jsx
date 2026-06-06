import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import { useChildren } from '../ChildrenContext';
import { useAuth } from '../AuthContext';

export default function StartupGate() {
  const { authLoading, isAuthenticated } = useAuth();
  const { children, childrenLoading, childrenError, selectedChildId, setSelectedChildId, refreshChildren } = useChildren();

  useEffect(() => {
    if (!authLoading && isAuthenticated && !childrenLoading && children.length > 0) {
      const selectedExists = children.some((child) => String(child.id) === String(selectedChildId));
      if (!selectedExists) {
        setSelectedChildId(children[0].id);
      }
    }
  }, [authLoading, isAuthenticated, children, childrenLoading, selectedChildId, setSelectedChildId]);

  if (authLoading || childrenLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm font-bold text-[#6f7da8]">Loading...</div>;
  }

  if (!isAuthenticated) {
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

  if (children.length === 0) {
    return <Navigate replace to="/create-child-profile" />;
  }

  if (children.some((child) => String(child.id) === String(selectedChildId))) {
    return <HomePage />;
  }

  return <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm font-bold text-[#6f7da8]">Loading...</div>;
}

export function RequireCurrentChild({ children }) {
  const { authLoading, isAuthenticated } = useAuth();
  const { children: childList, childrenLoading, childrenError, selectedChildId, setSelectedChildId, refreshChildren } = useChildren();
  const selectedExists = childList.some((child) => String(child.id) === String(selectedChildId));

  useEffect(() => {
    if (!authLoading && isAuthenticated && !childrenLoading && childList.length > 0 && (!selectedChildId || !selectedExists)) {
      setSelectedChildId(childList[0].id);
    }
  }, [authLoading, isAuthenticated, childList, childrenLoading, selectedChildId, selectedExists, setSelectedChildId]);

  if (authLoading || childrenLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm font-bold text-[#6f7da8]">Loading...</div>;
  }

  if (!isAuthenticated) {
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

  return selectedExists ? children : <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm font-bold text-[#6f7da8]">Loading...</div>;
}
