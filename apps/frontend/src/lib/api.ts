import { getToken, setToken, clearToken } from './auth';

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, '');
}

function resolveApiBase(): string {
  const envBase = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (envBase) return normalizeBase(envBase);

  // Production fallback to hosted API when env is missing/misconfigured.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'oakit.silveroakjuniors.in' || host.endsWith('.vercel.app') || host.endsWith('.railway.app')) {
      return 'https://oakit-api-gateway.onrender.com';
    }
  }

  return 'http://localhost:3001';
}

export const API_BASE = resolveApiBase();

// Attempt to refresh the JWT using the stored token.
// Returns the new token on success, or null if the session has truly expired.
let _refreshPromise: Promise<string | null> | null = null;
async function tryRefreshToken(): Promise<string | null> {
  // Deduplicate concurrent refresh attempts
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    const current = getToken();
    if (!current) return null;
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${current}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        return data.token as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

// Redirect to login and clear stored credentials
function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  clearToken();
  // Avoid redirect loops on the login page itself
  if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/auth')) {
    window.location.href = '/login';
  }
}

// Core fetch wrapper with automatic token refresh on 401
async function fetchWithRefresh(
  url: string,
  init: RequestInit,
  token?: string,
  _retried = false,
): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...init, headers });

  if (res.status === 401 && !_retried) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      // Retry once with the fresh token
      return fetchWithRefresh(url, init, newToken, true);
    }
    // Refresh failed — session is truly gone
    redirectToLogin();
  }

  return res;
}

export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetchWithRefresh(
    `${API_BASE}${path}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token ?? getToken() ?? undefined,
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetchWithRefresh(
    `${API_BASE}${path}`,
    { method: 'GET', headers: {} },
    token,
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export async function apiDelete(path: string, token: string): Promise<void> {
  const res = await fetchWithRefresh(
    `${API_BASE}${path}`,
    { method: 'DELETE', headers: {} },
    token,
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
}

export async function apiPatch<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetchWithRefresh(
    `${API_BASE}${path}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token,
  );
  const data = await res.json().catch(() => ({ error: 'Invalid response from server' }));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export async function apiPut<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetchWithRefresh(
    `${API_BASE}${path}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token,
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}
