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

// Student portal token helpers
export function getStudentToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('student_token');
}

export function setStudentToken(token: string): void {
  localStorage.setItem('student_token', token);
}

export function clearStudentToken(): void {
  localStorage.removeItem('student_token');
}

export function getRoleRedirect(role: string): string {
  const r = role.toLowerCase().trim();
  if (r === 'admin') return '/admin';
  if (['principal', 'vice principal', 'head teacher', 'center head'].includes(r)) return '/principal';
  if (['teacher', 'class teacher', 'supporting teacher'].includes(r)) return '/teacher';
  if (r === 'parent') return '/parent';
  if (r === 'super_admin') return '/super-admin';
  if (r === 'finance_manager') return '/admin';
  return '/login';
}

// Proper sign-out: calls logout API, clears local state, broadcasts to other tabs
export async function signOut(): Promise<void> {
  const token = getToken();
  const base = (typeof window !== 'undefined' && (window as any).__NEXT_PUBLIC_API_URL__) ||
    process.env.NEXT_PUBLIC_API_URL || '';
  if (token) {
    try {
      await fetch(`${base}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* ignore — still clear locally */ }
  }
  clearToken();
  try {
    const bc = new BroadcastChannel('oakit_session');
    bc.postMessage({ type: 'LOGOUT' });
    bc.close();
  } catch { /* BroadcastChannel not supported */ }
}
