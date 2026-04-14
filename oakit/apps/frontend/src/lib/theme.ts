/**
 * Brand Theme System
 * Customizable color themes for OakIT
 */

export interface ThemeConfig {
  primaryColor: string; // e.g., '#1F5636' (dark green) or '#DC2626' (red)
  name: string; // 'Green' | 'Red' | 'Blue' etc.
}

export const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#1F5636', // Dark green (OakIT brand)
  name: 'Green',
};

export const PRESET_THEMES: Record<string, ThemeConfig> = {
  green: {
    primaryColor: '#1F5636',
    name: 'Green',
  },
  red: {
    primaryColor: '#DC2626',
    name: 'Red',
  },
  blue: {
    primaryColor: '#1E40AF',
    name: 'Blue',
  },
  purple: {
    primaryColor: '#7C3AED',
    name: 'Purple',
  },
  emerald: {
    primaryColor: '#059669',
    name: 'Emerald',
  },
  teal: {
    primaryColor: '#0D9488',
    name: 'Teal',
  },
};

export interface ColorPalette {
  primary: string; // Main brand color
  primaryLight: string;
  primaryLighter: string;
  primaryLightest: string;
  secondary: string; // Complementary color
  success: string;
  warning: string;
  error: string;
  neutral: string;
}

/**
 * Converts hex to RGB for opacity manipulation
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

/**
 * Lightens a hex color by a percentage
 */
export function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const r = Math.round(Math.min(255, rgb.r + (255 - rgb.r) * (percent / 100)));
  const g = Math.round(Math.min(255, rgb.g + (255 - rgb.g) * (percent / 100)));
  const b = Math.round(Math.min(255, rgb.b + (255 - rgb.b) * (percent / 100)));
  
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Darkens a hex color by a percentage
 */
export function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const r = Math.round(rgb.r * (1 - percent / 100));
  const g = Math.round(rgb.g * (1 - percent / 100));
  const b = Math.round(rgb.b * (1 - percent / 100));
  
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Generates a complete color palette from a primary color
 */
export function generateColorPalette(primaryColor: string): ColorPalette {
  return {
    primary: primaryColor,
    primaryLight: lightenColor(primaryColor, 20),
    primaryLighter: lightenColor(primaryColor, 50),
    primaryLightest: lightenColor(primaryColor, 80),
    secondary: darkenColor(primaryColor, 15),
    success: '#10B981', // Emerald
    warning: '#F59E0B', // Amber
    error: '#EF4444', // Red
    neutral: '#6B7280', // Gray
  };
}

/**
 * Converts color palette to Tailwind CSS variables
 * Should be added to <style> tag in document root
 */
export function generateThemeCSS(palette: ColorPalette): string {
  return `
    :root {
      --color-primary: ${palette.primary};
      --color-primary-light: ${palette.primaryLight};
      --color-primary-lighter: ${palette.primaryLighter};
      --color-primary-lightest: ${palette.primaryLightest};
      --color-secondary: ${palette.secondary};
      --color-success: ${palette.success};
      --color-warning: ${palette.warning};
      --color-error: ${palette.error};
      --color-neutral: ${palette.neutral};
    }
  `;
}

/**
 * Generates Tailwind color classes as inline styles
 * For components that need dynamic theming without CSS vars
 */
export function getTailwindThemeStyles(palette: ColorPalette): Record<string, string> {
  return {
    'bg-primary': `background-color: ${palette.primary}`,
    'bg-primary-light': `background-color: ${palette.primaryLight}`,
    'bg-primary-lighter': `background-color: ${palette.primaryLighter}`,
    'bg-primary-lightest': `background-color: ${palette.primaryLightest}`,
    'text-primary': `color: ${palette.primary}`,
    'border-primary': `border-color: ${palette.primary}`,
    'hover-bg-primary-light': `background-color: ${palette.primaryLight}`,
  };
}
