import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'system',
  storageKey = 'nodeset-theme'
}) => {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null;
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      setThemeState(stored);
    } else {
      // Default to system preference
      setThemeState('system');
    }
  }, [storageKey]);

  // Update resolved theme based on theme setting and system preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateResolvedTheme = () => {
      let resolved: 'light' | 'dark';
      
      if (theme === 'system') {
        resolved = mediaQuery.matches ? 'dark' : 'light';
      } else {
        resolved = theme;
      }
      
      setResolvedTheme(resolved);
      
      // Apply theme to document
      const root = document.documentElement;
      if (resolved === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    updateResolvedTheme();
    
    // Listen for system theme changes
    const handler = () => {
      if (theme === 'system') {
        updateResolvedTheme();
      }
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(storageKey, newTheme);
  };

  const toggleTheme = () => {
    if (theme === 'system') {
      // When toggling from system, go to the opposite of current resolved theme
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    } else {
      // Toggle between light and dark
      setTheme(theme === 'light' ? 'dark' : 'light');
    }
  };

  const value: ThemeContextType = {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};