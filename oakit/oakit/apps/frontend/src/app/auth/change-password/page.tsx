'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Input } from '@/components/ui';
import { apiPost, apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface SecurityQuestion { id: string; text: string; }

export default function ChangePasswordPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [step, setStep] = useState<'password' | 'security'>('password');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [questions, setQuestions] = useState<SecurityQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    apiGet<SecurityQuestion[]>('/api/v1/auth/security-questions', token)
      .then(setQuestions)
      .catch(console.error);
  }, []);

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await apiPost('/api/v1/auth/change-password', { new_password: newPassword }, token);
      setStep('security');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  }

  async function handleSecuritySetup(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!selectedQuestion || !answer.trim()) {
      setError('Please select a question and provide an answer');
      return;
    }
    setLoading(true);
    try {
      await apiPost('/api/v1/auth/setup-security-question', {
        security_question_id: selectedQuestion,
        answer: answer.trim(),
      }, token);
      router.push('/teacher');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to set security question');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {step === 'password' ? (
          <Card padding="lg">
            <h1 className="text-xl font-semibold text-gray-800 mb-2">Change Your Password</h1>
            <p className="text-sm text-gray-500 mb-6">You must set a new password before continuing.</p>
            <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
              <Input
                label="New Password"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
              <Input
                label="Confirm Password"
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
              )}
              <Button type="submit" loading={loading} className="w-full">Set Password</Button>
            </form>
          </Card>
        ) : (
          <Card padding="lg">
            <h1 className="text-xl font-semibold text-gray-800 mb-2">Set Security Question</h1>
            <p className="text-sm text-gray-500 mb-6">This will be used to recover your account if you forget your password.</p>
            <form onSubmit={handleSecuritySetup} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Security Question</label>
                <select
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={selectedQuestion}
                  onChange={e => setSelectedQuestion(e.target.value)}
                  required
                >
                  <option value="">Select a question...</option>
                  {questions.map(q => <option key={q.id} value={q.id}>{q.text}</option>)}
                </select>
              </div>
              <Input
                label="Your Answer"
                type="text"
                placeholder="Answer (case-insensitive)"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                required
              />
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
              )}
              <Button type="submit" loading={loading} className="w-full">Save & Continue</Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
