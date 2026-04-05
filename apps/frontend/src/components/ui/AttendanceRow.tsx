'use client';

interface AttendanceRowProps {
  studentId: string;
  name: string;
  fatherName?: string;
  status: 'present' | 'absent' | null;
  onChange: (studentId: string, status: 'present' | 'absent') => void;
}

export default function AttendanceRow({ studentId, name, fatherName, status, onChange }: AttendanceRowProps) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-neutral-100 last:border-0">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={`
          w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0
          ${status === 'present' ? 'bg-emerald-100 text-emerald-700'
            : status === 'absent' ? 'bg-red-100 text-red-600'
            : 'bg-neutral-100 text-neutral-500'}
        `}>
          {name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-800">{name}</p>
          {fatherName && <p className="text-xs text-neutral-400">{fatherName}</p>}
        </div>
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={() => onChange(studentId, 'present')}
          className={`
            px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95
            ${status === 'present'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'bg-neutral-100 text-neutral-500 hover:bg-emerald-50 hover:text-emerald-700'
            }
          `}
        >
          Present
        </button>
        <button
          onClick={() => onChange(studentId, 'absent')}
          className={`
            px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95
            ${status === 'absent'
              ? 'bg-red-500 text-white shadow-sm'
              : 'bg-neutral-100 text-neutral-500 hover:bg-red-50 hover:text-red-600'
            }
          `}
        >
          Absent
        </button>
      </div>
    </div>
  );
}
