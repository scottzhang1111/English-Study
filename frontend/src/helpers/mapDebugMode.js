export const EIGO_MAP_DEBUG_MODE_KEY = 'eigo_map_debug_mode';

export function getMapDebugMode() {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(EIGO_MAP_DEBUG_MODE_KEY) === 'true';
  } catch (err) {
    return false;
  }
}

export function setMapDebugMode(value) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(EIGO_MAP_DEBUG_MODE_KEY, value ? 'true' : 'false');
  } catch (err) {
    // Keep debug mode as a local visual tool only; failing storage should not block the app.
  }
}
