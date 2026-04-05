'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Input } from '@/components/ui';
import { apiPost } from '@/lib/api';

type Step = 'init' | 'verify' | 'reset';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('init');
  const [schoolCode, setSchoolCode] = useState('');
  const [mobile, setMobile] = useState('');
  const [question, setQuestion] = useState('');
  const [userId, setUserId] = useState('');
  const [answer, setAnswer] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleInit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiPost<{ user_id: string; question: string }>(
        '/api/v1/auth/forgot-password/init',
        { school_code: schoolCode.trim().toLowerCase(), mobile: mobile.trim() }
      );
      setUserId(data.user_id);
      setQuestion(data.question);
      setStep('verify');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Not found');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiPost<{ reset_token: string }>(
        '/api/v1/auth/forgot-password/verify',
        { user_id: userId, answer: answer.trim() }
      );
      setResetToken(data.reset_token);
      setStep('reset');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Incorrect answer');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await apiPost('/api/v1/auth/forgot-password/reset', {
        reset_token: resetToken,
        new_password: newPassword,
      });
      router.push('/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Card padding="lg">
          {step === 'init' && (
            <>
              <h1 className="text-xl font-semibold text-gray-800 mb-2">Forgot Password</h1>
              <p className="text-sm text-gray-500 mb-6">Enter your school code and mobile number to continue.</p>
              <form onSubmit={handleInit} className="flex flex-col gap-4">
                <Input label="School Code" type="text" placeholder="e.g. sojs" value={schoolCode}
                  onChange={e => setSchoolCode(e.target.value)} required />
                <Input label="Mobile Number" type="tel" placeholder="10-digit mobile" value={mobile}
                  onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} required inputMode="numeric" />
                {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
                <Button type="submit" loading={loading} className="w-full">Continue</Button>
                <div className="text-center">
                  <Link href="/login" className="text-sm text-primary hover:underline">Back to login</Link>
                </div>
              </form>
            </>
          )}

          {step === 'verify' && (
            <>
              <h1 className="text-xl font-semibold text-gray-800 mb-2">Security Question</h1>
              <p className="text-sm text-gray-600 mb-4 bg-gray-50 rounded-lg px-4 py-3">{question}</p>
              <form onSubmit={handleVerify} className="flex flex-col gap-4">
                <Input label="Your Answer" type="text" placeholder="Answer" value={answer}
                  onChange={e => setAnswer(e.target.value)} required />
                {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
                <Button type="submit" loading={loading} className="w-full">Verify</Button>
              </form>
            </>
          )}

          {step === 'reset' && (
            <>
              <h1 className="text-xl font-semibold text-gray-800 mb-2">Set New Password</h1>
              <form onSubmit={handleReset} className="flex flex-col gap-4">
                <Input label="New Password" type="password" placeholder="At least 6 characters" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} required />
                <Input label="Confirm Password" type="password" placeholder="Repeat password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} required />
                {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
                <Button type="submit" loading={loading} className="w-full">Reset Password</Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
