'use client';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('oakit_token');
}

export function setToken(token: string): void {
  localStorage.setItem('oakit_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('oakit_token');
  localStorage.removeItem('oakit_role');
}

export function getRole(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('oakit_role');
}

export function setRole(role: string): void {
  localStorage.setItem('oakit_role', role);
}

export function getSchoolCode(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('oakit_school_code') || '';
}

export function setSchoolCode(code: string): void {
  localStorage.setItem('oakit_school_code', code);
}

export function getRoleRedirect(role: string): string {
  const r = role.toLowerCase().trim();
  if (r === 'admin') return '/admin';
  if (['principal', 'vice principal', 'head teacher', 'center head'].includes(r)) return '/principal';
  if (['teacher', 'class teacher', 'supporting teacher'].includes(r)) return '/teacher';
  if (r === 'parent') return '/parent';
  if (r === 'super_admin') return '/super-admin';
  // Any unrecognised role — fall back to login so they don't get stuck
  return '/login';
}
