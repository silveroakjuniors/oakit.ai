'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Loader2, Calendar, BookOpen, Trophy, MessageSquare, TrendingUp } from 'lucide-react';
import { PremiumHeader, PremiumTabNav, PremiumCard, PremiumStatPill } from '@/components/PremiumComponents';
import { Tab } from './types';
import {
  TodayTab,
  HomeworkTab,
  AskOakieTab,
  QuizTab,
  ProgressTab,
  StudentLayout,
} from './components';
import {
  useStudentAuth,
  useQuizState,
  useChat,
} from './hooks';
import {
  studentFeedService,
  studentHomeworkService,
  studentAuthService,
} from './api';
import { getTodayISO } from './utils';

export default function StudentPagePremium() {
  const { palette } = useTheme();
  const { isAuthenticated, profile, loading: authLoading, logout } = useStudentAuth();
  const quizState = useQuizState();
  const chatState = useChat();

  const [currentTab, setCurrentTab] = useState<Tab>('today');
  const [feedDate, setFeedDate] = useState(getTodayISO());
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ homework: 0, quizzes: 0, progress: 0, streak: 0 });

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      setLoading(false);
    }
  }, [isAuthenticated, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-100">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: palette.primary }} />
          <p className="text-neutral-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-100">
        <PremiumCard className="max-w-md">
          <div className="p-8 text-center">
            <p className="text-lg font-bold text-neutral-900 mb-2">Please log in</p>
            <p className="text-sm text-neutral-500">You need to be authenticated to view this page</p>
          </div>
        </PremiumCard>
      </div>
    );
  }

  const tabs = [
    { id: 'today', label: '📅 Today', icon: '📅' },
    { id: 'homework', label: '📚 Homework', icon: '📚' },
    { id: 'quiz', label: '🎯 Quizzes', icon: '🎯' },
    { id: 'progress', label: '📈 Progress', icon: '📈' },
    { id: 'ask-oakie', label: '💬 Ask Oakie', icon: '💬' },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-100">
      {/* Premium Header */}
      <PremiumHeader
        title={`Welcome, ${profile?.name || 'Student'}!`}
        subtitle="Your learning journey starts here"
        icon="🦁"
      />

      {/* Quick Stats */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <PremiumStatPill
            label="Homework"
            value={stats.homework}
            icon="📚"
            color="primary"
          />
          <PremiumStatPill
            label="Quizzes"
            value={stats.quizzes}
            icon="🎯"
            color="success"
          />
          <PremiumStatPill
            label="Progress"
            value={`${stats.progress}%`}
            icon="📈"
            color="warning"
          />
          <PremiumStatPill
            label="Streak"
            value={stats.streak}
            icon="🔥"
            color="error"
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-20 z-30 bg-white border-b border-neutral-200 overflow-x-auto">
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex gap-1 sm:gap-2 py-3 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id as Tab)}
                className={`px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                  currentTab === tab.id
                    ? 'text-white shadow-sm'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
                style={
                  currentTab === tab.id
                    ? { backgroundColor: palette.primary }
                    : {}
                }
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl mx-auto">
        {currentTab === 'today' && <TodayTab feedDate={feedDate} setFeedDate={setFeedDate} />}
        {currentTab === 'homework' && <HomeworkTab />}
        {currentTab === 'quiz' && <QuizTab />}
        {currentTab === 'progress' && <ProgressTab />}
        {currentTab === 'ask-oakie' && <AskOakieTab />}
      </div>
    </div>
  );
}
