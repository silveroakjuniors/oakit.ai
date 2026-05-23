export default function RolesSection() {
  const roles = [
    {
      role: 'Principal',
      tagline: 'See everything, act on what matters',
      features: ['Real-time school health dashboard', 'Curriculum coverage tracking', 'Teacher performance & streaks', 'Smart alerts & notifications', 'Attendance analytics'],
      gradient: 'from-[#1B4332] to-[#2d6a4f]',
      lightBg: 'bg-emerald-50',
    },
    {
      role: 'Teacher',
      tagline: 'Plan less, teach more',
      features: ['AI-generated daily lesson plans', 'One-tap attendance marking', 'Oakie AI assistant for any question', 'Child journey notes to parents', 'Homework & class feed'],
      gradient: 'from-blue-600 to-indigo-600',
      lightBg: 'bg-blue-50',
    },
    {
      role: 'Parent',
      tagline: 'Stay connected to your child\'s day',
      features: ['Daily updates & milestones', 'Homework notifications', 'Direct messaging with teacher', 'Attendance & progress reports', 'Photo & video class feed'],
      gradient: 'from-violet-600 to-purple-600',
      lightBg: 'bg-violet-50',
    },
    {
      role: 'Admin',
      tagline: 'Run operations effortlessly',
      features: ['Fee management & billing', 'Staff HR & salary', 'Student admissions & enquiries', 'Announcements & broadcasts', 'Complete audit trail'],
      gradient: 'from-amber-500 to-orange-500',
      lightBg: 'bg-amber-50',
    },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-sm font-semibold text-[#1B4332] uppercase tracking-widest mb-3">Built for every role</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1a1a2e] tracking-tight">
            Everyone gets their own experience
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Principals, teachers, parents, and admins — each sees exactly what they need.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {roles.map((r, i) => (
            <div key={i} className="card-hover rounded-2xl border border-gray-100 overflow-hidden bg-white">
              {/* Header */}
              <div className={`bg-gradient-to-r ${r.gradient} px-6 py-5`}>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">{r.role}</p>
                <p className="text-white text-lg font-bold mt-1">{r.tagline}</p>
              </div>
              {/* Features */}
              <div className="px-6 py-5">
                <ul className="space-y-3">
                  {r.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-sm text-gray-600">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
