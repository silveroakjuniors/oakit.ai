'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import Link from 'next/link';

const STEPS = [
  {
    id: 'school_profile',
    title: 'School Profile',
    icon: '🏫',
    desc: 'Set your school name, contact details, and branding.',
    help: 'This information appears on reports and parent communications.',
    action: '/admin/settings',
    actionLabel: 'Go to Settings →',
  },
  {
    id: 'classes_sections',
    title: 'Classes & Sections',
    icon: '📚',
    desc: 'Create your classes (Play Group, Nursery, LKG, UKG) and sections (A, B, C).',
    help: 'Each section will have its own teacher, curriculum, and attendance.',
    action: '/admin/classes',
    actionLabel: 'Manage Classes →',
  },
  {
    id: 'staff_accounts',
    title: 'Staff Accounts',
    icon: '👥',
    desc: 'Add teachers, principal, and admin staff. Assign them to sections.',
    help: 'Staff log in with their mobile number. Password is set to mobile on first login.',
    action: '/admin/users',
    actionLabel: 'Manage Staff →',
  },
  {
    id: 'curriculum_upload',
    title: 'Curriculum Upload',
    icon: '📄',
    desc: 'Upload curriculum PDFs for each class. Oakie will extract topics automatically.',
    help: 'Upload one PDF per class. The AI will chunk it into daily topics.',
    action: '/admin/curriculum',
    actionLabel: 'Upload Curriculum →',
  },
  {
    id: 'calendar_setup',
    title: 'Calendar Setup',
    icon: '📅',
    desc: 'Set your academic year dates, working days, holidays, and settling period.',
    help: 'This drives the daily plan generation. Set it before generating plans.',
    action: '/admin/calendar',
    actionLabel: 'Set Up Calendar →',
  },
];

export default function SetupWizardPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<any>('/api/v1/admin/setup/progress', token)
      .then(data => {
        setCompletedSteps(data.completed_steps ?? []);
        const firstPending = STEPS.findIndex(s => !(data.completed_steps ?? []).includes(s.id));
        setCurrentStep(firstPending >= 0 ? firstPending : STEPS.length - 1);
      })
      .catch(() => {});
  }, []);

  async function markDone(stepId: string) {
    setSaving(true);
    try {
      await apiPost('/api/v1/admin/setup/progress', { step: stepId }, token);
      const updated = [...new Set([...completedSteps, stepId])];
      setCompletedSteps(updated);
      if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
    } catch {}
    finally { setSaving(false); }
  }

  const allDone = STEPS.every(s => completedSteps.includes(s.id));
  const step = STEPS[currentStep];

  return (
    <div className="p-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-neutral-900">School Setup Wizard</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Complete these steps to get your school ready on Oakit</p>
        </div>

        {allDone ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <p className="text-3xl mb-2">🎉</p>
            <p className="text-lg font-bold text-green-800">Setup Complete!</p>
            <p className="text-sm text-green-700 mt-1">Your school is ready. Go to the dashboard to start using Oakit.</p>
            <Link href="/admin" className="inline-block mt-4 px-5 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors">
              Go to Dashboard →
            </Link>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-neutral-500">Step {currentStep + 1} of {STEPS.length}</p>
                <p className="text-xs text-neutral-400">{completedSteps.length} of {STEPS.length} complete</p>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div className="h-2 rounded-full bg-primary-600 transition-all duration-500"
                  style={{ width: `${(completedSteps.length / STEPS.length) * 100}%` }} />
              </div>
            </div>

            {/* Step cards */}
            <div className="flex flex-col gap-3 mb-6">
              {STEPS.map((s, i) => {
                const done = completedSteps.includes(s.id);
                const active = i === currentStep;
                return (
                  <div key={s.id} onClick={() => !done && setCurrentStep(i)}
                    className={`border rounded-2xl p-4 transition-all cursor-pointer ${active ? 'border-primary-300 bg-primary-50/50 shadow-sm' : done ? 'border-green-200 bg-green-50/30' : 'border-neutral-200 bg-white hover:border-neutral-300'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${done ? 'bg-green-100' : active ? 'bg-primary-100' : 'bg-neutral-100'}`}>
                        {done ? '✓' : s.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${done ? 'text-green-700' : active ? 'text-primary-800' : 'text-neutral-600'}`}>{s.title}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{s.desc}</p>
                        {active && (
                          <p className="text-xs text-primary-600 mt-1.5 bg-primary-50 px-2 py-1 rounded-lg inline-block">💡 {s.help}</p>
                        )}
                      </div>
                      {done && <span className="text-green-500 text-lg shrink-0">✓</span>}
                    </div>
                    {active && (
                      <div className="flex gap-2 mt-3 pl-12">
                        <Link href={s.action}
                          className="text-xs text-primary-600 font-medium px-3 py-2 rounded-lg bg-primary-100 hover:bg-primary-200 transition-colors">
                          {s.actionLabel}
                        </Link>
                        <button onClick={() => markDone(s.id)} disabled={saving}
                          className="text-xs text-white font-medium px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 transition-colors">
                          {saving ? 'Saving...' : 'Mark as Done ✓'}
                        </button>
                        {currentStep < STEPS.length - 1 && (
                          <button onClick={() => setCurrentStep(currentStep + 1)}
                            className="text-xs text-neutral-500 px-3 py-2 rounded-lg hover:bg-neutral-100 transition-colors">
                            Skip for now
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
  );
}
