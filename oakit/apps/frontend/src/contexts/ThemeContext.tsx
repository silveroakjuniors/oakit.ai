'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeConfig, DEFAULT_THEME, ColorPalette, generateColorPalette, generateThemeCSS } from '@/lib/theme';

type ColorMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeConfig;
  palette: ColorPalette;
  setTheme: (config: ThemeConfig) => Promise<void>;
  loading: boolean;
  colorMode: ColorMode;
  toggleColorMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeConfig>(DEFAULT_THEME);
  const [palette, setPalette] = useState<ColorPalette>(generateColorPalette(DEFAULT_THEME.primaryColor));
  const [loading, setLoading] = useState(true);
  const [styleId] = useState('oakit-theme-styles');
  const [colorMode, setColorMode] = useState<ColorMode>('light');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedMode = localStorage.getItem('oakit-color-mode') as ColorMode | null;
        if (savedMode === 'dark' || savedMode === 'light') {
          setColorMode(savedMode);
          document.documentElement.classList.toggle('dark', savedMode === 'dark');
        }

        const savedTheme = localStorage.getItem('oakit-theme');
        if (savedTheme) {
          const parsed: ThemeConfig = JSON.parse(savedTheme);
          setThemeState(parsed);
          setPalette(generateColorPalette(parsed.primaryColor));
        } else {
          const token = localStorage.getItem('token');
          if (token) {
            try {
              const response = await fetch('/api/admin/settings/theme', {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (response.ok) {
                const data = await response.json();
                const newTheme: ThemeConfig = {
                  primaryColor: data.primaryColor || DEFAULT_THEME.primaryColor,
                  name: data.name || DEFAULT_THEME.name,
                };
                setThemeState(newTheme);
                setPalette(generateColorPalette(newTheme.primaryColor));
                localStorage.setItem('oakit-theme', JSON.stringify(newTheme));
              }
            } catch { /* fall back to default */ }
          }
        }
      } catch {
        setThemeState(DEFAULT_THEME);
        setPalette(generateColorPalette(DEFAULT_THEME.primaryColor));
      } finally {
        setLoading(false);
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    const css = generateThemeCSS(palette);
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = css;
    const root = document.documentElement;
    root.style.setProperty('--color-primary', palette.primary);
    root.style.setProperty('--color-primary-light', palette.primaryLight);
    root.style.setProperty('--color-primary-lighter', palette.primaryLighter);
    root.style.setProperty('--color-primary-lightest', palette.primaryLightest);
    root.style.setProperty('--color-secondary', palette.secondary);
    root.style.setProperty('--color-success', palette.success);
    root.style.setProperty('--color-warning', palette.warning);
    root.style.setProperty('--color-error', palette.error);
  }, [palette, styleId]);

  const toggleColorMode = () => {
    setColorMode(prev => {
      const next: ColorMode = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('oakit-color-mode', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  };

  const setTheme = async (newTheme: ThemeConfig) => {
    setLoading(true);
    try {
      localStorage.setItem('oakit-theme', JSON.stringify(newTheme));
      setThemeState(newTheme);
      setPalette(generateColorPalette(newTheme.primaryColor));
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await fetch('/api/admin/settings/theme', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(newTheme),
          });
        } catch { /* ignore */ }
      }
    } catch (error) {
      console.error('Failed to set theme:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, palette, setTheme, loading, colorMode, toggleColorMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
