'use client';
import { getToken } from '@/lib/auth';
import SchoolFeedPanel from '../dashboard/SchoolFeedPanel';

export default function PrincipalFeedPage() {
  const token = getToken() || '';
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-neutral-800">School Feed</h1>
        <p className="text-xs text-neutral-400 mt-0.5">View all class posts · post school-wide moments</p>
      </div>
      <SchoolFeedPanel token={token} />
    </div>
  );
}
