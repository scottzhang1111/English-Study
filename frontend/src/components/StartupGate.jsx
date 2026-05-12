import { Navigate } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import AddChildPage from '../pages/AddChildPage';
import ChildSelectPage from '../pages/ChildSelectPage';
import { clearInvalidChildData, getChildren, getCurrentChildId, setCurrentChildId } from '../utils/childStorage';

export default function StartupGate() {
  clearInvalidChildData();
  const children = getChildren();
  const currentChildId = getCurrentChildId();

  if (children.length === 0) {
    return <AddChildPage />;
  }

  if (children.length === 1) {
    if (currentChildId !== children[0].id) {
      setCurrentChildId(children[0].id);
    }
    return <HomePage />;
  }

  if (children.some((child) => child.id === currentChildId)) {
    return <HomePage />;
  }

  return <ChildSelectPage />;
}

export function RequireCurrentChild({ children }) {
  clearInvalidChildData();
  const hasCurrentChild = Boolean(getCurrentChildId() && getChildren().some((child) => child.id === getCurrentChildId()));
  return hasCurrentChild ? children : <Navigate replace to="/" />;
}
