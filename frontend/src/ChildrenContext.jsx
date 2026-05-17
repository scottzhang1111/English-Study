import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getChildren } from './api';

const ChildrenContext = createContext(null);
let initialChildrenRequest = null;
const CHILD_STORAGE_KEY = 'selected_child_id';

export function ChildrenProvider({ children }) {
  const [childrenList, setChildrenList] = useState([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [childrenError, setChildrenError] = useState('');
  const [selectedChildId, setSelectedChildIdState] = useState(() => localStorage.getItem(CHILD_STORAGE_KEY) || '');

  const setSelectedChildId = useCallback((childId) => {
    const nextId = childId ? String(childId) : '';
    if (nextId) {
      localStorage.setItem(CHILD_STORAGE_KEY, nextId);
    } else {
      localStorage.removeItem(CHILD_STORAGE_KEY);
      try {
        sessionStorage.removeItem(CHILD_STORAGE_KEY);
      } catch (err) {
        // sessionStorage can be unavailable in restricted browser modes.
      }
    }
    setSelectedChildIdState(nextId);
  }, []);

  const refreshChildren = useCallback(async ({ force = true } = {}) => {
    setChildrenLoading(true);
    setChildrenError('');
    try {
      if (!force && initialChildrenRequest) {
        const cachedList = await initialChildrenRequest;
        setChildrenList(cachedList);
        return cachedList;
      }

      const request = getChildren().then((payload) => payload.children || []);
      if (!force) {
        initialChildrenRequest = request;
      }
      window.__childrenApiCallCount = (window.__childrenApiCallCount || 0) + 1;
      console.log('[children api call count]', window.__childrenApiCallCount);
      const list = await request;
      setChildrenList(list);
      return list;
    } catch (err) {
      setChildrenError(err.message || 'children API failed');
      setChildrenList([]);
      return [];
    } finally {
      setChildrenLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshChildren({ force: false });
  }, [refreshChildren]);

  const value = useMemo(
    () => ({
      children: childrenList,
      childrenLoading,
      childrenError,
      selectedChildId,
      setSelectedChildId,
      refreshChildren,
    }),
    [childrenList, childrenLoading, childrenError, selectedChildId, setSelectedChildId, refreshChildren],
  );

  return <ChildrenContext.Provider value={value}>{children}</ChildrenContext.Provider>;
}

export function useChildren() {
  const context = useContext(ChildrenContext);
  if (!context) {
    throw new Error('useChildren must be used inside ChildrenProvider');
  }
  return context;
}
