'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, signOut } from '@/lib/auth';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const HEARTBEAT_MS = 60 * 1000; // check session every 60s
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export function useSessionManager() {
  const router = useRouter();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const logout = useCallback(async (reason?: string) => {
    await signOut();
    const url = reason ? `/login?reason=${encodeURIComponent(reason)}` : '/login';
    router.push(url);
  }, [router]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => logout('idle'), IDLE_TIMEOUT_MS);
  }, [logout]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = getToken();
    if (!token) return;

    // ── Idle timeout ──────────────────────────────────────────────────
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer(); // start timer immediately

    // ── Cross-tab logout via BroadcastChannel ─────────────────────────
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('oakit_session');
      bc.onmessage = (e) => {
        if (e.data?.type === 'LOGOUT') {
          // Another tab signed out — clear and redirect without calling API again
          import('@/lib/auth').then(({ clearToken }) => {
            clearToken();
            router.push('/login');
          });
        }
      };
    } catch { /* BroadcastChannel not supported */ }

    // ── Heartbeat: detect session replaced on another device ──────────
    heartbeatTimer.current = setInterval(async () => {
      const t = getToken();
      if (!t) return;
      try {
        const res = await fetch(`${API_BASE}/api/v1/auth/session-check`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (res.status === 401) {
          const data = await res.json().catch(() => ({}));
          if (data.code === 'SESSION_REPLACED') {
            logout('replaced');
          } else {
            logout('expired');
          }
        }
      } catch { /* network error — don't logout */ }
    }, HEARTBEAT_MS);

    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      bc?.close();
    };
  }, [logout, resetIdleTimer, router]);
}
