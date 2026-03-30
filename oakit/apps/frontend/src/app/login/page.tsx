'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import OakitLogo from '@/components/OakitLogo';
import { Button, Input, Card } from '@/components/ui';
import { apiPost } from '@/lib/api';
import { setToken, setRole, setSchoolCode, getSchoolCode, getRoleRedirect } from '@/lib/auth';

interface LoginResponse {
  token: string;
  role: string;
  force_password_reset?: boolean;
  attendance_prompt?: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const [schoolCode, setSchoolCodeState] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = getSchoolCode();
    if (saved) setSchoolCodeState(saved);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (mobile && !/^\d{10}$/.test(mobile)) {
      setError('Mobile number must be 10 digits');
      return;
    }

    setLoading(true);
    try {
      const data = await apiPost<LoginResponse>('/api/v1/auth/login', {
        school_code: schoolCode.trim().toLowerCase(),
        mobile: mobile.trim(),
        password,
      });

      setToken(data.token);
      setRole(data.role);
      setSchoolCode(schoolCode.trim().toLowerCase());

      if (data.force_password_reset) {
        router.push('/auth/change-password');
        return;
      }

      router.push(getRoleRedirect(data.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-accent/5" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <OakitLogo size="lg" />
          <p className="mt-2 text-gray-500 text-sm">AI-powered curriculum management</p>
        </div>

        <Card padding="lg">
          <h1 className="text-xl font-semibold text-gray-800 mb-6">Sign in to your account</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="School Code"
              type="text"
              placeholder="e.g. sojs"
              value={schoolCode}
              onChange={(e) => setSchoolCodeState(e.target.value)}
              required
              autoComplete="organization"
            />

            <Input
              label="Mobile Number"
              type="tel"
              placeholder="10-digit mobile number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              required
              autoComplete="tel"
              inputMode="numeric"
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
              Sign in
            </Button>

            <div className="text-center">
              <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
                Forgot Password?
              </Link>
            </div>
          </form>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Oakit.ai — Silveroak Juniors
        </p>
      </div>
    </div>
  );
}
