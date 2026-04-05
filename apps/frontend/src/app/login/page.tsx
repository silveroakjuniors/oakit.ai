'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import OakitLogo from '@/components/OakitLogo';
import { apiPost } from '@/lib/api';
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
  const [schoolCode, setSchoolCodeState] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // --- Logic: Hydration Fix & Load Saved Code ---
  useEffect(() => {
    const saved = getSchoolCode();
    if (saved) setSchoolCodeState(saved);
    setMounted(true); // Mark as mounted to solve hydration issues
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    
    if (!schoolCode.trim()) {
      setError('School code is required');
      return;
    }

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

      // Fetch and apply brand colour in background
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const settingsRes = await fetch(`${API_BASE}/api/v1/admin/settings`, {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          if (s.primary_color) applyBrandColor(s.primary_color);
          if (s.tagline !== undefined) saveTagline(s.tagline || '');
        }
      } catch { /* non-critical */ }
      
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

  // Prevent hydration mismatch by returning a skeleton or null until mounted
  if (!mounted) {
    return <div className="min-h-screen bg-[#0f2417]" />;
  }

  return (
    <div className="min-h-screen flex bg-white font-sans">
      
      {/* --- Left Panel: Branding --- */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#0f2417] flex-col justify-between p-16 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500 blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-emerald-700 blur-[100px]" />
        </div>
        <div className="relative z-10">
          <OakitLogo size="md" variant="light" showTagline />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="relative group">
            <div className="absolute -inset-1 bg-emerald-500/20 rounded-full blur group-hover:blur-xl transition duration-1000"></div>
            <img src="/oakie.png" alt="Oakie AI" className="relative w-64 h-auto object-contain brightness-110 drop-shadow-2xl animate-float" />
          </div>
          <h2 className="text-white text-3xl font-black mt-8 tracking-tight">I am Oakie</h2>
          <p className="text-emerald-400/80 font-bold uppercase tracking-[0.2em] text-xs mt-2">Your Personal AI Mentor</p>
        </div>
        <div className="relative z-10">
          <div className="h-1 w-12 bg-emerald-500 mb-6 rounded-full" />
          <blockquote className="text-emerald-50/90 text-xl font-medium leading-relaxed italic max-w-sm">
            "Empowering schools with AI-driven curriculum management."
          </blockquote>
        </div>
      </div>

      {/* --- Right Panel: Form --- */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-slate-50">
        <div className="lg:hidden mb-10">
          <OakitLogo size="sm" variant="dark" showTagline />
        </div>

        <div className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back</h1>
            <p className="text-slate-500 font-medium mt-2 text-sm italic">
              {schoolCode ? `Signing you into ${schoolCode.toUpperCase()}` : 'Sign in to continue to Oakit.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* School Code: Display ONLY if no saved code is found in storage */}
            {!getSchoolCode() && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">School Code</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                    <School size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. sojs"
                    value={schoolCode}
                    onChange={e => setSchoolCodeState(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                  <Smartphone size={18} />
                </div>
                <input
                  type="tel"
                  placeholder="10-digit number"
                  value={mobile}
                  onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  required
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-emerald-700 font-black hover:underline underline-offset-4">
                  Forgot?
                </Link>
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-12 py-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3 flex items-center gap-3 animate-shake">
                <AlertCircle className="text-rose-500 shrink-0" size={18} />
                <p className="text-xs text-rose-700 font-bold uppercase tracking-tight">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0f2417] text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-emerald-900/20 hover:bg-emerald-900 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={20} />
                  <span>SIGNING IN...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  SIGN IN
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </button>
          </form>

          {/* Hidden "Clear Cache" button for testing/emergencies */}
          <div className="mt-8 text-center">
            <button 
              onClick={() => { localStorage.removeItem('school_code'); window.location.reload(); }}
              className="text-[10px] text-slate-300 font-bold hover:text-emerald-600 transition-colors uppercase tracking-[0.2em]"
            >
              Reset Connection
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
        .animate-float { animation: float 4s ease-in-out infinite; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        .animate-shake { animation: shake 0.3s ease-in-out; }
      `}</style>
    </div>
  );
}
