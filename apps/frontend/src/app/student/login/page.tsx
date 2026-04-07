'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '@/lib/api';
import OakitLogo from '@/components/OakitLogo';

function setStudentToken(token: string) { localStorage.setItem('student_token', token); }

export default function StudentLogin() {
  const router = useRouter();
  const [schoolCode, setSchoolCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/student-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_code: schoolCode, username: username.toLowerCase().trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      setStudentToken(data.token);
      if (data.force_password_reset) {
        router.push('/student/change-password');
      } else {
        router.push('/student');
      }
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0f2417 0%, #1e5c3a 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <OakitLogo size="lg" variant="light" />
          <p className="text-white/60 text-sm mt-2">Student Portal</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          <h1 className="text-lg font-bold text-neutral-800 mb-5">Sign in to learn 🌱</h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-neutral-500 mb-1 block">School Code</label>
              <input value={schoolCode} onChange={e => setSchoolCode(e.target.value)}
                placeholder="e.g. sojs" required
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500 mb-1 block">Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)}
                placeholder="e.g. aarav-lkg-a" required autoCapitalize="none"
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500 mb-1 block">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Your password" required
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
