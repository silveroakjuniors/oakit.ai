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
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{name}</p>
        {fatherName && <p className="text-xs text-gray-400">{fatherName}</p>}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(studentId, 'present')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-w-[80px] ${
            status === 'present'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-green-100'
          }`}
        >
          Present
        </button>
        <button
          onClick={() => onChange(studentId, 'absent')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-w-[80px] ${
            status === 'absent'
              ? 'bg-red-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-red-100'
          }`}
        >
          Absent
        </button>
      </div>
    </div>
  );
}
