import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import ChildSelectPage from '../pages/ChildSelectPage';
import { useChildren } from '../ChildrenContext';

const CHILD_STORAGE_KEY = 'selected_child_id';

function clearSelectedChildId() {
  localStorage.removeItem(CHILD_STORAGE_KEY);
  try {
    sessionStorage.removeItem(CHILD_STORAGE_KEY);
  } catch (err) {
    // sessionStorage can be unavailable in restricted browser modes.
  }
}

export default function StartupGate() {
  const { children, childrenLoading, childrenError, refreshChildren } = useChildren();
  const [selectedChildId, setSelectedChildId] = useState(localStorage.getItem(CHILD_STORAGE_KEY) || '');

  useEffect(() => {
    if (!childrenLoading && selectedChildId && !children.some((child) => String(child.id) === String(selectedChildId))) {
      clearSelectedChildId();
      setSelectedChildId('');
    }
  }, [children, childrenLoading, selectedChildId]);

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
    clearSelectedChildId();
    return <HomePage />;
  }

  if (children.length === 1 && !selectedChildId) {
    localStorage.setItem(CHILD_STORAGE_KEY, String(children[0].id));
    return <HomePage />;
  }

  if (children.some((child) => String(child.id) === String(selectedChildId))) {
    return <HomePage />;
  }

  return <ChildSelectPage />;
}

export function RequireCurrentChild({ children }) {
  const { children: childList, childrenLoading, childrenError, refreshChildren } = useChildren();
  const selectedChildId = localStorage.getItem(CHILD_STORAGE_KEY) || '';
  const selectedExists = childList.some((child) => String(child.id) === String(selectedChildId));

  useEffect(() => {
    if (!childrenLoading && (!selectedChildId || !selectedExists)) {
      clearSelectedChildId();
    }
  }, [childrenLoading, selectedChildId, selectedExists]);

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
