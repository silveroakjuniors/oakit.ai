'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PrincipalPlannerRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/teacher/planner'); }, []);
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-neutral-400">Redirecting to Planner…</p>
    </div>
  );
}
