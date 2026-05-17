import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import ChildSelectPage from '../pages/ChildSelectPage';
import { useChildren } from '../ChildrenContext';

export default function StartupGate() {
  const { children, childrenLoading, childrenError, selectedChildId, setSelectedChildId, refreshChildren } = useChildren();

  useEffect(() => {
    if (!childrenLoading && children.length === 1 && !selectedChildId) {
      setSelectedChildId(children[0].id);
      return;
    }
    if (!childrenLoading && selectedChildId && !children.some((child) => String(child.id) === String(selectedChildId))) {
      setSelectedChildId('');
    }
  }, [children, childrenLoading, selectedChildId, setSelectedChildId]);

  if (childrenLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm font-bold text-[#6f7da8]">Loading...</div>;
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
    setSelectedChildId('');
    return <HomePage />;
  }

  if (children.length === 1 && !selectedChildId) {
    return <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm font-bold text-[#6f7da8]">Loading...</div>;
  }

  if (children.some((child) => String(child.id) === String(selectedChildId))) {
    return <HomePage />;
  }

  return <ChildSelectPage />;
}

export function RequireCurrentChild({ children }) {
  const { children: childList, childrenLoading, childrenError, selectedChildId, setSelectedChildId, refreshChildren } = useChildren();
  const selectedExists = childList.some((child) => String(child.id) === String(selectedChildId));

  useEffect(() => {
    if (!childrenLoading && (!selectedChildId || !selectedExists)) {
      setSelectedChildId('');
    }
  }, [childrenLoading, selectedChildId, selectedExists, setSelectedChildId]);

  if (childrenLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm font-bold text-[#6f7da8]">Loading...</div>;
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

  return childList.length > 0 && selectedExists ? children : <Navigate replace to="/settings/children" />;
}
