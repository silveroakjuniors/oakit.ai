'use client';
import { useState } from 'react';

const faqs = [
  { q: 'How long does it take to set up?', a: 'Most schools are up and running in under 30 minutes. Upload your curriculum PDFs, add your classes and teachers, and Oakie handles the rest. Our onboarding team is available to help if needed.' },
  { q: 'Do teachers need training?', a: 'Oakit is designed to be intuitive. Teachers typically start using it within their first session. The AI assistant (Oakie) guides them through any questions they have about the platform or their curriculum.' },
  { q: 'What about data privacy?', a: 'Each school is completely isolated (multi-tenant architecture). We use role-based access control, PII protection for franchise users, and all data is encrypted. We comply with Indian data protection regulations.' },
  { q: 'Can parents use it on their phone?', a: 'Yes! The parent portal is a Progressive Web App (PWA) that works beautifully on any smartphone. Parents can install it like a native app — no app store download needed.' },
  { q: 'What curriculum formats do you support?', a: 'We support any PDF textbook. Our AI extracts topics, chapters, and activities automatically. We work with all major Indian preschool and primary school curricula.' },
  { q: 'Can we manage multiple branches?', a: 'Absolutely. Our Enterprise plan includes a franchise portal where you can manage curriculum centrally, view cross-school analytics, and maintain brand consistency across all branches.' },
  { q: 'What happens after the free trial?', a: 'After 14 days, you can choose a plan that fits your school. All your data is preserved. If you decide not to continue, we provide a full data export.' },
  { q: 'Is there a mobile app for teachers?', a: 'The teacher portal is a responsive web app optimized for mobile. Teachers can mark attendance, view plans, chat with Oakie, and send updates to parents — all from their phone.' },
];

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 bg-gray-50/50">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-[#1B4332] uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1a1a2e] tracking-tight">
            Common questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <span className="text-sm font-semibold text-[#1a1a2e] pr-4">{faq.q}</span>
                <svg className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {open === i && (
                <div className="px-6 pb-4">
                  <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
