'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeConfig, DEFAULT_THEME, ColorPalette, generateColorPalette, generateThemeCSS } from '@/lib/theme';

interface ThemeContextType {
  theme: ThemeConfig;
  palette: ColorPalette;
  setTheme: (config: ThemeConfig) => Promise<void>;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Theme Provider Component
 * Wrap your app with this to enable theming
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeConfig>(DEFAULT_THEME);
  const [palette, setPalette] = useState<ColorPalette>(generateColorPalette(DEFAULT_THEME.primaryColor));
  const [loading, setLoading] = useState(true);
  const [styleId] = useState('oakit-theme-styles');

  // Load theme from localStorage on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        // Try to load from localStorage first
        const savedTheme = localStorage.getItem('oakit-theme');
        if (savedTheme) {
          const parsed: ThemeConfig = JSON.parse(savedTheme);
          setThemeState(parsed);
          setPalette(generateColorPalette(parsed.primaryColor));
        } else {
          // Load from API (admin settings)
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
            } catch {
              // Fall back to default
            }
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

  // Update DOM CSS variables when theme changes
  useEffect(() => {
    const css = generateThemeCSS(palette);
    let style = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    
    style.textContent = css;

    // Also set CSS custom properties for direct access
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

  const setTheme = async (newTheme: ThemeConfig) => {
    setLoading(true);
    try {
      // Save to localStorage
      localStorage.setItem('oakit-theme', JSON.stringify(newTheme));
      
      // Update state
      setThemeState(newTheme);
      setPalette(generateColorPalette(newTheme.primaryColor));

      // Save to API (admin settings)
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await fetch('/api/admin/settings/theme', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(newTheme),
          });
        } catch {
          // Ignore API errors, theme is still updated locally
        }
      }
    } catch (error) {
      console.error('Failed to set theme:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, palette, setTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to use theme context in any component
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
