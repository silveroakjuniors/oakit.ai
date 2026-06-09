'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { setToken, setRole, setSchoolCode } from '@/lib/auth';
import OakitLogo from '@/components/OakitLogo';
import { Lock, ShieldCheck, Loader2 } from 'lucide-react';

interface SecurityQuestion { id: string; text: string; }

export default function FirstLoginSetupPage() {
  const router = useRouter();
  const [context, setContext] = useState<{
    school_code: string; mobile: string; name: string; child_name?: string; account_type: string;
  } | null>(null);

  const [step, setStep] = useState<'password' | 'security' | 'done'>('password');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [questions, setQuestions] = useState<SecurityQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setLocalToken] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('oakit_first_login');
    if (!stored) { router.push('/login'); return; }
    setContext(JSON.parse(stored));
  }, [router]);

  const welcomeText = context?.account_type === 'parent'
    ? `Welcome${context.name ? `, ${context.name}` : ''}${context.child_name ? ` (Parent of ${context.child_name})` : ''}!`
    : `Welcome${context?.name ? `, ${context.name}` : ''}!`;

  async function handlePasswordSet(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    if (!context) return;
    if (newPassword === context.mobile) { setError('Password cannot be your mobile number'); return; }
    setLoading(true);
    try {
      // Login with default password (mobile number) first
      const loginRes = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_code: context.school_code, mobile: context.mobile, password: context.mobile }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.error || 'Login failed');
      const authToken = loginData.token;
      setLocalToken(authToken);

      // Change password
      const changeRes = await fetch(`${API_BASE}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const changeData = await changeRes.json();
      if (!changeRes.ok) throw new Error(changeData.error || 'Failed to change password');

      // Load security questions
      const qRes = await fetch(`${API_BASE}/api/v1/auth/security-questions`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const qData = await qRes.json();
      if (qRes.ok && Array.isArray(qData)) setQuestions(qData);

      setStep('security');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to set password');
    } finally { setLoading(false); }
  }

  async function handleSecuritySet(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!selectedQuestion || !answer.trim()) { setError('Please select a question and provide an answer'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/setup-security-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ security_question_id: selectedQuestion, answer: answer.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      // Store token and show success before redirect
      setToken(token);
      setRole(context?.account_type === 'parent' ? 'parent' : 'teacher');
      setSchoolCode(context?.school_code || '');
      sessionStorage.removeItem('oakit_first_login');
      setStep('done');

      // Brief pause to show success, then redirect
      const redirect = context?.account_type === 'parent' ? '/parent' : '/teacher';
      setTimeout(() => router.push(redirect), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally { setLoading(false); }
  }

  if (!context) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <OakitLogo size="sm" variant="dark" />
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          {step === 'password' ? (
            <>
              <div className="text-center mb-6">
                <h1 className="text-xl font-bold text-gray-900">{welcomeText}</h1>
                <p className="text-sm text-gray-500 mt-2">
                  Please set a new password to secure your account.
                </p>
              </div>
              <form onSubmit={handlePasswordSet} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input type="password" placeholder="At least 6 characters" value={newPassword}
                      onChange={e => setNewPassword(e.target.value)} required
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input type="password" placeholder="Repeat password" value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)} required
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500" />
                  </div>
                </div>
                {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-2.5 font-medium">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#1a4a2e,#1F7A5A)' }}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {loading ? 'Setting up...' : 'Set Password & Continue'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <ShieldCheck size={32} className="text-emerald-600 mx-auto mb-2" />
                <h1 className="text-xl font-bold text-gray-900">Set Security Question</h1>
                <p className="text-sm text-gray-500 mt-2">
                  This helps you recover your account if you forget your password.
                </p>
              </div>
              <form onSubmit={handleSecuritySet} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Security Question</label>
                  <select value={selectedQuestion} onChange={e => setSelectedQuestion(e.target.value)} required
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500">
                    <option value="">Select a question...</option>
                    {questions.map(q => <option key={q.id} value={q.id}>{q.text}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Your Answer</label>
                  <input type="text" placeholder="Answer (not case-sensitive)" value={answer}
                    onChange={e => setAnswer(e.target.value)} required
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500" />
                </div>
                {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-2.5 font-medium">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#1a4a2e,#1F7A5A)' }}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {loading ? 'Saving...' : 'Save & Start Using Oakit'}
                </button>
              </form>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={32} className="text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">All set!</h2>
              <p className="text-sm text-gray-500">Your account is ready. Redirecting you now...</p>
              <div className="mt-4">
                <Loader2 size={20} className="animate-spin text-emerald-600 mx-auto" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
