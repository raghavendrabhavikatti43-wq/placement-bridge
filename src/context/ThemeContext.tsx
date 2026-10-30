import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'placement_bridge_theme';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
    } catch {
      // Ignore storage access errors
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage write errors
    }
  }, [theme]);

  const setTheme = (mode: ThemeMode) => setThemeState(mode);
  const toggleTheme = () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

interface ThemeToggleButtonProps {
  compact?: boolean;
  className?: string;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({
  compact = false,
  className = '',
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-container-high bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${className}`}
    >
      <span className="material-symbols-outlined text-[17px] text-secondary">
        {isDark ? 'light_mode' : 'dark_mode'}
      </span>
      <span className={compact ? 'hidden sm:inline' : ''}>
        {isDark ? 'Light Mode' : 'Dark Mode'}
      </span>
    </button>
  );
};

export const ThemeModeSelector: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Select interface theme"
      className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-container-low border border-surface-container-high shrink-0"
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          theme === 'light'
            ? 'bg-surface-container-lowest text-on-surface shadow-xs'
            : 'text-outline hover:text-on-surface'
        }`}
      >
        <span className="material-symbols-outlined text-[16px]">light_mode</span>
        <span>Light Mode</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          theme === 'dark'
            ? 'bg-surface-container-lowest text-on-surface shadow-xs'
            : 'text-outline hover:text-on-surface'
        }`}
      >
        <span className="material-symbols-outlined text-[16px]">dark_mode</span>
        <span>Dark Mode</span>
      </button>
    </div>
  );
};
