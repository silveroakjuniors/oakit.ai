'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Curriculum management lives under /admin/curriculum.
// Principal has access to the same routes — redirect there.
export default function PrincipalCurriculumRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/curriculum'); }, []);
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-neutral-400">Redirecting to Curriculum…</p>
    </div>
  );
}
