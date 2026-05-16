const CHILDREN_KEY = 'children';
const CURRENT_CHILD_ID_KEY = 'selected_child_id';

export const DEFAULT_PARTNER_ID = 'bulbasaur';

export const PARTNERS = {
  bulbasaur: {
    id: 'bulbasaur',
    name: 'フシギダネ',
    imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png',
  },
  charmander: {
    id: 'charmander',
    name: 'ヒトカゲ',
    imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png',
  },
  squirtle: {
    id: 'squirtle',
    name: 'ゼニガメ',
    imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png',
  },
};

/**
 * @typedef {Object} ChildProfile
 * @property {string} id
 * @property {string} name
 * @property {string} grade
 * @property {string} targetLevel
 * @property {string} partnerMonsterId
 * @property {string} createdAt
 * @property {string} updatedAt
 */

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Storage can fail in private mode; keep the app rendering.
  }
}

function normalizeChild(child) {
  if (!child || typeof child !== 'object') return null;
  const id = String(child.id || '').trim();
  const name = String(child.name || '').trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    grade: String(child.grade || '小学2年生'),
    targetLevel: String(child.targetLevel || child.target_level || '準2級'),
    partnerMonsterId: String(child.partnerMonsterId || child.partner_monster_id || DEFAULT_PARTNER_ID),
    createdAt: String(child.createdAt || new Date().toISOString()),
    updatedAt: String(child.updatedAt || child.createdAt || new Date().toISOString()),
  };
}

export function getChildren() {
  if (typeof window === 'undefined') return [];
  const parsed = readJson(CHILDREN_KEY, []);
  if (!Array.isArray(parsed)) {
    saveChildren([]);
    return [];
  }
  const children = parsed.map(normalizeChild).filter(Boolean);
  if (children.length !== parsed.length) {
    saveChildren(children);
  }
  return children;
}

export function saveChildren(children) {
  if (typeof window === 'undefined') return;
  const safeChildren = Array.isArray(children) ? children.map(normalizeChild).filter(Boolean) : [];
  writeJson(CHILDREN_KEY, safeChildren);
}

export function getCurrentChildId() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(CURRENT_CHILD_ID_KEY) || '';
  } catch (err) {
    return '';
  }
}

export function setCurrentChildId(childId) {
  if (typeof window === 'undefined') return;
  try {
    if (childId) {
      window.localStorage.setItem(CURRENT_CHILD_ID_KEY, String(childId));
    } else {
      window.localStorage.removeItem(CURRENT_CHILD_ID_KEY);
    }
  } catch (err) {
    // Keep rendering even when storage is unavailable.
  }
}

export function getCurrentChild() {
  const children = getChildren();
  const currentChildId = getCurrentChildId();
  const child = children.find((item) => item.id === currentChildId) || null;
  if (currentChildId && !child) {
    setCurrentChildId('');
  }
  return child;
}

export function addChild(child) {
  const now = new Date().toISOString();
  const nextChild = normalizeChild({
    ...child,
    id: child.id || `child_${Date.now()}`,
    createdAt: child.createdAt || now,
    updatedAt: now,
  });
  if (!nextChild) {
    throw new Error('invalid child profile');
  }
  const children = getChildren();
  saveChildren([...children, nextChild]);
  return nextChild;
}

export function updateChild(childId, updates) {
  const children = getChildren();
  const now = new Date().toISOString();
  const nextChildren = children.map((child) =>
    child.id === childId ? normalizeChild({ ...child, ...updates, id: child.id, updatedAt: now }) : child,
  );
  saveChildren(nextChildren);
  return nextChildren.find((child) => child.id === childId) || null;
}

export function clearInvalidChildData() {
  const children = getChildren();
  const currentChildId = getCurrentChildId();
  if (currentChildId && !children.some((child) => child.id === currentChildId)) {
    setCurrentChildId('');
  }
  return { children, currentChildId: getCurrentChildId() };
}

export function getPartner(partnerMonsterId) {
  return PARTNERS[partnerMonsterId] || PARTNERS[DEFAULT_PARTNER_ID];
}
