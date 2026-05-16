import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import ChildSelectPage from '../pages/ChildSelectPage';
import { getChildren } from '../api';

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
  const [children, setChildren] = useState(null);
  const [selectedChildId, setSelectedChildId] = useState(localStorage.getItem(CHILD_STORAGE_KEY) || '');

  useEffect(() => {
    let cancelled = false;
    getChildren()
      .then((payload) => {
        if (cancelled) return;
        const childList = payload.children || [];
        setChildren(childList);
        if (selectedChildId && !childList.some((child) => String(child.id) === String(selectedChildId))) {
          clearSelectedChildId();
          setSelectedChildId('');
        }
      })
      .catch(() => setChildren([]));
    return () => {
      cancelled = true;
    };
  }, [selectedChildId]);

  if (children === null) {
    return <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm font-bold text-[#6f7da8]">Loading...</div>;
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
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const selectedChildId = localStorage.getItem(CHILD_STORAGE_KEY) || '';
    if (!selectedChildId) {
      clearSelectedChildId();
      setAllowed(false);
      return undefined;
    }

    getChildren()
      .then((payload) => {
        if (cancelled) return;
        const childList = payload.children || [];
        const selectedExists = childList.some((child) => String(child.id) === String(selectedChildId));
        if (!selectedExists) {
          clearSelectedChildId();
        }
        setAllowed(childList.length > 0 && selectedExists);
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (allowed === null) {
    return <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm font-bold text-[#6f7da8]">Loading...</div>;
  }

  return allowed ? children : <Navigate replace to="/settings/children" />;
}
