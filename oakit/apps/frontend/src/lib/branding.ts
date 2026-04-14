'use client';

const COLOR_KEY = 'oakit_brand_color';
const TAGLINE_KEY = 'oakit_tagline';

/** Darken a hex colour by a percentage */
function darken(hex: string, pct: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - Math.round(((n >> 16) * pct) / 100));
  const g = Math.max(0, ((n >> 8) & 0xff) - Math.round((((n >> 8) & 0xff) * pct) / 100));
  const b = Math.max(0, (n & 0xff) - Math.round(((n & 0xff) * pct) / 100));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Lighten a hex colour by a percentage */
function lighten(hex: string, pct: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (n >> 16) + Math.round(((255 - (n >> 16)) * pct) / 100));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(((255 - ((n >> 8) & 0xff)) * pct) / 100));
  const b = Math.min(255, (n & 0xff) + Math.round(((255 - (n & 0xff)) * pct) / 100));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function applyBrandColor(color: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', color);
  root.style.setProperty('--brand-primary-dark', darken(color, 15));
  root.style.setProperty('--brand-primary-light', lighten(color, 30));
  root.style.setProperty('--color-primary', color);
  localStorage.setItem(COLOR_KEY, color);
}

export function loadSavedBrandColor() {
  if (typeof window === 'undefined') return;
  const saved = localStorage.getItem(COLOR_KEY);
  if (saved) applyBrandColor(saved);
}

export function getBrandColor(): string {
  if (typeof window === 'undefined') return '#1A3C2E';
  return localStorage.getItem(COLOR_KEY) ?? '#1A3C2E';
}

export function saveTagline(tagline: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TAGLINE_KEY, tagline);
}

export function getTagline(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(TAGLINE_KEY) ?? '';
}
