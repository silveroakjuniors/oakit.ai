'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import OakitLogo from '@/components/OakitLogo';
import { API_BASE, apiPost } from '@/lib/api';
import { setToken, setRole, setSchoolCode, getSchoolCode, getRoleRedirect } from '@/lib/auth';
import { applyBrandColor, saveTagline } from '@/lib/branding';
import { Lock, Smartphone, School, Eye, EyeOff, Loader2, AlertCircle, ArrowRight } from 'lucide-react';

interface LoginResponse {
  token: string;
  role: string;
  force_password_reset?: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isSuperAdminLogin, setIsSuperAdminLogin] = useState(false);
  const [schoolCode, setSchoolCodeState] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [aiStatus, setAiStatus] = useState<'checking' | 'up' | 'down'>('checking');
  const [sessionMsg, setSessionMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const superAdmin = params.get('superadmin') === '1';
    setIsSuperAdminLogin(superAdmin);
    if (superAdmin) { setSchoolCodeState('platform'); setMounted(true); return; }
    const saved = getSchoolCode();
    if (saved) { setSchoolCodeState(saved); fetchSchoolName(saved); }
    // Show reason message if redirected from session manager
    const reason = params.get('reason');
    if (reason === 'idle') setSessionMsg('You were signed out due to 15 minutes of inactivity.');
    else if (reason === 'replaced') setSessionMsg('Your session was ended because you signed in from another device.');
    else if (reason === 'expired') setSessionMsg('Your session has expired. Please sign in again.');
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isSuperAdminLogin) return;
    let active = true;
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/health/ai`);
        const d = await res.json().catch(() => ({}));
        if (!active) return;
        setAiStatus(res.ok && d.ai === 'up' ? 'up' : 'down');
      } catch { if (active) setAiStatus('down'); }
    };
    check();
    const id = window.setInterval(check, 30000);
    return () => { active = false; window.clearInterval(id); };
  }, [isSuperAdminLogin]);

  async function fetchSchoolName(code: string) {
    if (!code || code.length < 2) { setSchoolName(''); return; }
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/school-info?code=${encodeURIComponent(code.toLowerCase())}`);
      if (res.ok) { const d = await res.json(); setSchoolName(d.name || ''); }
      else setSchoolName('');
    } catch { setSchoolName(''); }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!schoolCode.trim()) { setError('School code is required'); return; }
    if (mobile && !/^\d{10}$/.test(mobile)) { setError('Mobile number must be 10 digits'); return; }
    setLoading(true);
    try {
      const code = isSuperAdminLogin ? 'platform' : schoolCode.trim().toLowerCase();
      const data = await apiPost<LoginResponse>('/api/v1/auth/login', {
        school_code: code, mobile: mobile.trim(), password,
      });
      setToken(data.token);
      setRole(data.role);
      setSchoolCode(code);
      try {
        const s = await fetch(`${API_BASE}/api/v1/admin/settings`, { headers: { Authorization: `Bearer ${data.token}` } });
        if (s.ok) { const sd = await s.json(); if (sd.primary_color) applyBrandColor(sd.primary_color); if (sd.tagline !== undefined) saveTagline(sd.tagline || ''); }
      } catch { /* non-critical */ }
      if (data.force_password_reset) { router.push('/auth/change-password'); return; }
      router.push(getRoleRedirect(data.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally { setLoading(false); }
  }

  if (!mounted) return <div className="min-h-screen" style={{ background: '#0D1F14' }} />;

  // ── Super-admin: dark platform login ─────────────────────────────────
  if (isSuperAdminLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#09090B 0%,#18181B 60%,#1C1917 100%)' }}>
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="relative w-full max-w-sm z-10">
          <div className="text-center mb-8">
            <OakitLogo size="md" variant="light" />
            <span className="mt-3 inline-block text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Platform Admin
            </span>
          </div>
          <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold text-white">Sign In</h1>
              <div className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                aiStatus === 'up' ? 'text-emerald-400' : aiStatus === 'down' ? 'text-red-400' : 'text-amber-400'
              }`} style={{ background: 'rgba(255,255,255,0.06)' }}>
                <span className={`w-1.5 h-1.5 rounded-full ${aiStatus === 'up' ? 'bg-emerald-400 animate-pulse' : aiStatus === 'down' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'}`} />
                AI {aiStatus === 'up' ? 'Online' : aiStatus === 'down' ? 'Down' : '…'}
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Mobile</label>
                <input type="tel" placeholder="10-digit number" value={mobile}
                  onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} required
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password}
                    onChange={e => setPassword(e.target.value)} required
                    className="w-full px-4 py-3 pr-11 rounded-xl text-sm font-medium text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs font-medium rounded-xl px-3 py-2.5" style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg,#1F7A5A,#2A9470)', boxShadow: '0 4px 16px rgba(31,122,90,0.3)' }}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? 'Signing in…' : 'Sign In →'}
              </button>
            </form>
          </div>
          <p className="text-center mt-5">
            <button onClick={() => { localStorage.removeItem('oakit_school_code'); window.location.reload(); }}
              className="text-[11px] transition-colors" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Reset Connection
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Standard login: split-screen, one form for all roles ─────────────
  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter',-apple-system,sans-serif" }}>

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[44%] flex-col justify-between p-14 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg,#0D1F14 0%,#1a4a2e 50%,#1F7A5A 100%)' }}>
        {/* Blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-20" style={{ background: '#52B788' }} />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full blur-3xl opacity-15" style={{ background: '#2EC4B6' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl opacity-10" style={{ background: '#74C69D' }} />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <OakitLogo size="sm" variant="light" showTagline />
        </div>

        {/* Oakie + headline */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="absolute -inset-6 rounded-full blur-2xl opacity-25" style={{ background: '#52B788' }} />
            <img src="/oakie.png" alt="Oakie AI" className="relative w-52 h-auto object-contain drop-shadow-2xl"
              style={{ animation: 'float 4s ease-in-out infinite' }} />
          </div>
          <h2 className="text-white text-3xl font-black tracking-tight leading-tight">
            I am Oakie
          </h2>
          <p className="text-emerald-300/70 text-sm mt-2 font-medium tracking-wide uppercase" style={{ letterSpacing: '0.15em' }}>
            Your School's AI Mentor
          </p>
          <div className="flex items-center gap-3 mt-6">
            {['Teachers', 'Admins', 'Principals', 'Parents'].map(r => (
              <span key={r} className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.12)' }}>
                {r}
              </span>
            ))}
          </div>
        </div>

        {/* Quote */}
        <div className="relative z-10">
          <div className="h-px w-10 mb-5 rounded-full" style={{ background: 'rgba(82,183,136,0.5)' }} />
          <p className="text-emerald-50/70 text-base italic leading-relaxed max-w-xs">
            "Empowering schools with AI-driven curriculum management."
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-gray-50">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10">
          <OakitLogo size="sm" variant="dark" showTagline />
        </div>

        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/60 border border-gray-100 p-9">
            <div className="mb-8">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Welcome back</h1>
              <p className="text-sm text-gray-400 mt-1.5">
                {schoolName
                  ? `Signing into ${schoolName}`
                  : schoolCode
                    ? `School: ${schoolCode.toUpperCase()}`
                    : 'Sign in to continue to Oakit'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* School code — only if not cached */}
              {!getSchoolCode() && (
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2">School Code</label>
                  <div className="relative">
                    <School size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                    <input type="text" placeholder="e.g. sojs" value={schoolCode}
                      onChange={e => { setSchoolCodeState(e.target.value); fetchSchoolName(e.target.value); }} required
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all" />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Mobile Number</label>
                <div className="relative">
                  <Smartphone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                  <input type="tel" placeholder="10-digit number" value={mobile}
                    onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} required
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Password</label>
                  <Link href="/auth/forgot-password" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                  <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password}
                    onChange={e => setPassword(e.target.value)} required
                    className="w-full pl-11 pr-11 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {sessionMsg && (
                <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                  <AlertCircle size={15} className="text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 font-medium">{sessionMsg}</p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                  <AlertCircle size={15} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-600 font-semibold">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-4 rounded-2xl text-white font-bold text-sm transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg,#1a4a2e 0%,#1F7A5A 100%)',
                  boxShadow: '0 8px 24px rgba(31,122,90,0.30)',
                }}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                {loading ? 'Signing in…' : 'Sign In'}
                {!loading && <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />}
              </button>
            </form>
          </div>

          {/* Footer links */}
          <div className="flex items-center justify-between mt-6 px-1">
            <Link href="/student/login" className="text-sm text-gray-400 hover:text-emerald-600 transition-colors">
              🎒 Student login
            </Link>
            <button onClick={() => { localStorage.removeItem('oakit_school_code'); window.location.reload(); }}
              className="text-xs text-gray-300 hover:text-gray-500 transition-colors">
              Reset connection
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
      `}</style>
    </div>
  );
}
