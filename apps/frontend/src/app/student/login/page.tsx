'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '@/lib/api';
import { Eye, EyeOff, Loader2, AlertCircle, BookOpen, Star, Zap } from 'lucide-react';

function setStudentToken(token: string) { localStorage.setItem('student_token', token); }

// Fun facts shown while loading
const FUN_FACTS = [
  'Did you know? Reading for 20 minutes a day exposes you to 1.8 million words a year! 📚',
  'Your brain is more active when you\'re sleeping than when watching TV! 🧠',
  'Honey never spoils — archaeologists found 3000-year-old honey in Egyptian tombs! 🍯',
  'A group of flamingos is called a "flamboyance"! 🦩',
  'The first computer bug was an actual bug — a moth found in a computer in 1947! 🦋',
];

export default function StudentLogin() {
  const router = useRouter();
  const [schoolCode, setSchoolCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [factIdx, setFactIdx] = useState(0);
  const [stars, setStars] = useState<{ x: number; y: number; size: number; delay: number }[]>([]);

  useEffect(() => {
    // Generate random stars for background
    setStars(Array.from({ length: 20 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 3,
    })));
    // Rotate fun facts
    const id = setInterval(() => setFactIdx(i => (i + 1) % FUN_FACTS.length), 5000);
    return () => clearInterval(id);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/student-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_code: schoolCode.trim().toLowerCase(),
          username: username.toLowerCase().trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      setStudentToken(data.token);
      router.push(data.force_password_reset ? '/student/change-password' : '/student');
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#0D1B2A 0%,#1B2838 40%,#0F3460 100%)' }}>

      {/* Animated stars */}
      {stars.map((s, i) => (
        <div key={i} className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            opacity: 0.4,
            animation: `twinkle ${2 + s.delay}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`,
          }} />
      ))}

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-3xl opacity-10"
        style={{ background: '#4F46E5' }} />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full blur-3xl opacity-10"
        style={{ background: '#7C3AED' }} />

      <div className="relative w-full max-w-sm z-10">

        {/* Header */}
        <div className="text-center mb-8">
          {/* Oakie mascot */}
          <div className="relative inline-block mb-4">
            <div className="absolute -inset-3 rounded-full blur-xl opacity-40"
              style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }} />
            <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto"
              style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', boxShadow: '0 8px 32px rgba(79,70,229,0.5)' }}>
              🌱
            </div>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Oakit<span style={{ color: '#F59E0B' }}>.ai</span>
          </h1>
          <p className="text-white/50 text-sm mt-1 font-medium">Student Learning Portal</p>

          {/* XP / streak teaser */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
              <Zap size={12} />
              <span>Earn XP daily</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(79,70,229,0.15)', color: '#818CF8', border: '1px solid rgba(79,70,229,0.3)' }}>
              <Star size={12} />
              <span>Build streaks</span>
            </div>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-3xl p-7 border"
          style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(20px)' }}>

          <h2 className="text-lg font-bold text-white mb-5">Sign in to learn 🚀</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest block mb-1.5">School Code</label>
              <input value={schoolCode} onChange={e => setSchoolCode(e.target.value)}
                placeholder="e.g. sojs" required autoCapitalize="none"
                className="w-full px-4 py-3 rounded-2xl text-sm font-medium text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-400/50 transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }} />
            </div>

            <div>
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest block mb-1.5">Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)}
                placeholder="e.g. aarav-lkg-a" required autoCapitalize="none" autoCorrect="off"
                className="w-full px-4 py-3 rounded-2xl text-sm font-medium text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-400/50 transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }} />
            </div>

            <div>
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest block mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="Your password" required
                  className="w-full px-4 py-3 pr-11 rounded-2xl text-sm font-medium text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-400/50 transition-all"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-semibold"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', boxShadow: '0 8px 24px rgba(79,70,229,0.4)' }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
              {loading ? 'Signing in…' : 'Start Learning'}
            </button>
          </form>
        </div>

        {/* Fun fact ticker */}
        <div className="mt-6 rounded-2xl px-4 py-3 text-center"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs text-white/40 font-medium leading-relaxed transition-all duration-500">
            💡 {FUN_FACTS[factIdx]}
          </p>
        </div>

        {/* Back to main login */}
        <p className="text-center mt-5">
          <a href="/login" className="text-xs text-white/30 hover:text-white/50 transition-colors">
            ← Back to main login
          </a>
        </p>
      </div>

      <style jsx global>{`
        @keyframes twinkle {
          0%,100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
}
