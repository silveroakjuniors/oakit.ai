'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';

type PushStatus = 'unsupported' | 'denied' | 'prompt' | 'subscribed' | 'unsubscribed' | 'loading';

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }

    // Check current permission
    const permission = Notification.permission;
    if (permission === 'denied') {
      setStatus('denied');
      return;
    }

    // Check if already subscribed
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setStatus(sub ? 'subscribed' : 'unsubscribed');
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      setError(null);

      // Register service worker if not already
      const reg = await navigator.serviceWorker.register('/sw-push.js');
      await navigator.serviceWorker.ready;

      // Get VAPID public key from backend
      const { publicKey } = await apiGet<{ publicKey: string }>('/api/v1/push/vapid-public-key', token);
      if (!publicKey) {
        setError('Push notifications not configured on server');
        return;
      }

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }

      // Subscribe to push
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send subscription to backend
      await apiPost('/api/v1/push/subscribe', {
        subscription: subscription.toJSON(),
        device_info: navigator.userAgent.slice(0, 100),
      }, token);

      setStatus('subscribed');
    } catch (err: any) {
      setError(err.message || 'Failed to subscribe');
      console.error('[Push] Subscribe error:', err);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    const token = getToken();
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        if (token) {
          await apiPost('/api/v1/push/unsubscribe', { endpoint }, token);
        }
      }
      setStatus('unsubscribed');
    } catch (err: any) {
      setError(err.message || 'Failed to unsubscribe');
    }
  }, []);

  return { status, error, subscribe, unsubscribe };
}

// Helper to convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
