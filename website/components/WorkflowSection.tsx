export default function WorkflowSection() {
  const steps = [
    { num: '01', title: 'Upload Curriculum', desc: 'Upload your textbook PDFs. Oakie extracts topics, chapters, and activities automatically.', color: 'bg-emerald-500' },
    { num: '02', title: 'AI Plans Your Month', desc: 'Oakie creates day-by-day lesson plans mapped to your academic calendar, holidays, and pace.', color: 'bg-blue-500' },
    { num: '03', title: 'Teachers Execute', desc: 'Teachers see today\'s plan, mark completion, record attendance, and send updates to parents.', color: 'bg-violet-500' },
    { num: '04', title: 'Parents Stay Connected', desc: 'Parents get daily updates, homework, milestones, and can chat with teachers — all in the app.', color: 'bg-amber-500' },
    { num: '05', title: 'Principal Monitors', desc: 'Real-time dashboards show coverage, attendance, teacher engagement, and smart alerts.', color: 'bg-rose-500' },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-gray-50/50 relative overflow-hidden">
      <div className="absolute inset-0 bg-dots opacity-40" />
      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-sm font-semibold text-[#1B4332] uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1a1a2e] tracking-tight">
            From PDF to daily plans in minutes
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            A simple 5-step workflow that transforms how your school operates.
          </p>
        </div>

        {/* Workflow steps */}
        <div className="max-w-3xl mx-auto">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-6 mb-8 last:mb-0">
              {/* Timeline */}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full ${step.color} flex items-center justify-center text-white text-xs font-bold shadow-lg`}>
                  {step.num}
                </div>
                {i < steps.length - 1 && (
                  <div className="w-0.5 flex-1 bg-gradient-to-b from-gray-300 to-gray-100 mt-2" />
                )}
              </div>
              {/* Content */}
              <div className="pb-8">
                <h3 className="text-lg font-bold text-[#1a1a2e] mb-1">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Flow diagram */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6 text-center">Data Flow</p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              {[
                { label: 'PDF Upload', bg: 'bg-emerald-100 text-emerald-700' },
                { label: '→', bg: 'text-gray-300' },
                { label: 'AI Extraction', bg: 'bg-blue-100 text-blue-700' },
                { label: '→', bg: 'text-gray-300' },
                { label: 'Monthly Plans', bg: 'bg-violet-100 text-violet-700' },
                { label: '→', bg: 'text-gray-300' },
                { label: 'Daily Execution', bg: 'bg-amber-100 text-amber-700' },
                { label: '→', bg: 'text-gray-300' },
                { label: 'Parent Updates', bg: 'bg-rose-100 text-rose-700' },
              ].map((item, i) => (
                item.label === '→' ? (
                  <span key={i} className="text-gray-300 text-lg hidden sm:block">→</span>
                ) : (
                  <span key={i} className={`px-3 py-1.5 rounded-full font-medium text-xs ${item.bg}`}>{item.label}</span>
                )
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
