import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';

const ACCESS_KEY = 'soj_access_token';
const REFRESH_KEY = 'soj_refresh_token';

type AuthContextType = {
  accessToken: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: any) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync(ACCESS_KEY);
      setAccessToken(token);
      setLoading(false);
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    const data = res.data || {};
    const access = data.access_token || data.accessToken || data.token;
    const refresh = data.refresh_token || data.refreshToken;
    if (access) {
      await SecureStore.setItemAsync(ACCESS_KEY, access);
      setAccessToken(access);
    }
    if (refresh) {
      await SecureStore.setItemAsync(REFRESH_KEY, refresh);
    }
  };

  const signOut = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (e) {
      // ignore
    }
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    setAccessToken(null);
  };

  return (
    <AuthContext.Provider value={{ accessToken, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
