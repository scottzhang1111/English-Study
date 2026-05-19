import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export const THEME_SCHEMES = ['soft-kids', 'clean-study', 'premium', 'workbook'];

const DEFAULT_THEME_SCHEME = 'soft-kids';
const STORAGE_KEY = 'themeScheme';

const ThemeSchemeContext = createContext({
  themeScheme: DEFAULT_THEME_SCHEME,
  setThemeScheme: () => {},
});

function normalizeThemeScheme(value) {
  return THEME_SCHEMES.includes(value) ? value : DEFAULT_THEME_SCHEME;
}

function applyThemeScheme(value) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = normalizeThemeScheme(value);
}

function readStoredThemeScheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME_SCHEME;

  try {
    return normalizeThemeScheme(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_SCHEME;
  }
}

export function ThemeSchemeProvider({ children }) {
  const [themeSchemeState, setThemeSchemeState] = useState(() => {
    const storedThemeScheme = readStoredThemeScheme();
    applyThemeScheme(storedThemeScheme);
    return storedThemeScheme;
  });

  const setThemeScheme = useCallback((nextThemeScheme) => {
    const normalizedThemeScheme = normalizeThemeScheme(nextThemeScheme);
    setThemeSchemeState(normalizedThemeScheme);
    applyThemeScheme(normalizedThemeScheme);

    try {
      window.localStorage.setItem(STORAGE_KEY, normalizedThemeScheme);
    } catch {
      // Local storage can be unavailable in private or restricted browsers.
    }
  }, []);

  const value = useMemo(
    () => ({
      themeScheme: themeSchemeState,
      setThemeScheme,
    }),
    [setThemeScheme, themeSchemeState],
  );

  return <ThemeSchemeContext.Provider value={value}>{children}</ThemeSchemeContext.Provider>;
}

export function useThemeScheme() {
  return useContext(ThemeSchemeContext);
}
