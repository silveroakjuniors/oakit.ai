'use client';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getToken } from '@/lib/auth';
import ReportCardGenerator from '@/components/ReportCardGenerator';

export default function TeacherReportsPage() {
  const router = useRouter();
  const token = getToken() || '';

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-neutral-400 hover:text-neutral-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-neutral-900">Report Cards</h1>
          <p className="text-xs text-neutral-500">Generate descriptive report cards for your students</p>
        </div>
      </header>
      <div className="p-4 max-w-2xl mx-auto">
        <ReportCardGenerator token={token} role="teacher" />
      </div>
    </div>
  );
}
