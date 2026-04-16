'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Star, Zap, BookOpen, Mic, Brain, MessageCircle, Globe, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Pricing data ─────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'whatsapp',
    icon: '💬',
    name: 'WhatsApp Notifications',
    tagline: 'Get school updates directly on WhatsApp',
    price: 800,
    period: 'year',
    color: 'emerald',
    badge: null,
    forAges: 'All ages',
    features: [
      'Homework alerts sent to your WhatsApp',
      'Attendance notifications (present / absent / late)',
      'School announcements on WhatsApp',
      'Weekly progress summary every Friday',
      'Emergency alerts from school',
      'Parent-teacher meeting reminders',
      'All communication stays within Oakit — WhatsApp is notifications only',
    ],
    description: 'Receive important school updates directly on WhatsApp — homework, attendance, announcements and more. All teacher communication still happens through the Oakit portal. WhatsApp is for notifications only, not direct chat.',
  },
  {
    id: 'multilingual',
    icon: '🌐',
    name: 'Multilingual Support',
    tagline: 'Read everything in your language',
    price: 499,
    period: 'year',
    color: 'indigo',
    badge: null,
    forAges: 'All ages',
    features: [
      'Full portal in Hindi, Telugu, Kannada, Tamil & more',
      '10 Indian languages + Arabic, French, Spanish',
      'Homework & notes translated automatically',
      'Teacher messages translated',
      'Announcements in your language',
    ],
    description: 'Read homework, teacher notes, and school announcements in your preferred language. Supports 10 Indian languages and 3 international languages.',
  },
  {
    id: 'speak',
    icon: '🗣️',
    name: 'Speak & Evaluate',
    tagline: 'Build spoken English & language skills',
    price: 1000,
    period: 'year',
    color: 'blue',
    badge: 'Pre-Primary',
    forAges: 'Playgroup · Nursery · LKG · UKG',
    features: [
      'Weekly age-appropriate speaking topics',
      'Female voice narration — child listens first',
      '30-minute daily learning sessions',
      'Child records their response (with parent help)',
      'AI evaluates pronunciation & fluency',
      'Weekly progress rating & improvement tips',
      'Fun game-like interface for kids',
    ],
    description: 'Every week, your child gets a new topic to learn — narrated in a warm female voice. They listen, understand, then try to speak it back. We record and evaluate their response, giving you a rating and tips to improve.',
    howItWorks: [
      { step: '1', title: 'Listen', desc: 'Child listens to the week\'s topic narrated in a clear female voice (5-10 mins)' },
      { step: '2', title: 'Understand', desc: 'Simple visuals and repetition help the child grasp the concept' },
      { step: '3', title: 'Speak Back', desc: 'Child records themselves speaking the topic (parent assists)' },
      { step: '4', title: 'Evaluate', desc: 'AI rates pronunciation, fluency, and confidence. You get a weekly report.' },
    ],
  },
  {
    id: 'story',
    icon: '📖',
    name: 'Story & Evaluate',
    tagline: 'Reading, listening & storytelling skills',
    price: 1000,
    period: 'year',
    color: 'violet',
    badge: 'Pre-Primary',
    forAges: 'Playgroup · Nursery · LKG · UKG',
    features: [
      '20-25 age-appropriate stories curated by educators',
      'Stories spread across the year by difficulty',
      'Audio narration with expressive voice',
      'Child listens then retells the story',
      'LKG/UKG: read the story aloud and record',
      'AI evaluates comprehension & expression',
      'Progress tracking across all stories',
    ],
    description: 'A curated library of 20-25 stories, carefully selected for each age group. Children listen to stories, then retell them in their own words. For LKG/UKG, they read aloud and we evaluate their reading.',
    howItWorks: [
      { step: '1', title: 'Listen', desc: 'Child listens to the story with expressive narration and sound effects' },
      { step: '2', title: 'Retell', desc: 'Child retells the story in their own words (recorded with parent help)' },
      { step: '3', title: 'Read (LKG/UKG)', desc: 'Older children read the story text aloud and record themselves' },
      { step: '4', title: 'Evaluate', desc: 'AI rates comprehension, vocabulary, and expression. Monthly progress report.' },
    ],
  },
  {
    id: 'competitive',
    icon: '🏆',
    name: 'Competitive Exam Prep',
    tagline: 'Build knowledge from an early age',
    price: 1500,
    period: 'year',
    color: 'amber',
    badge: 'K-12',
    forAges: 'Grade 1 – Grade 12',
    features: [
      '3 topics of your choice per year',
      'Science, Universe, World Map, History, Scientists',
      'Innovation, Technology, General Knowledge & more',
      'Age-appropriate content for each grade',
      '30 mins daily preparation + 15 mins test',
      'MCQ and descriptive question formats',
      'Unlimited retakes — improve at your own pace',
      'Detailed performance analytics & ratings',
    ],
    description: 'Prepare your child for competitive exams from an early age. Choose 3 topics from a curated list of general knowledge subjects. Daily 30-minute preparation sessions followed by 15-minute tests. Track improvement over time.',
    howItWorks: [
      { step: '1', title: 'Choose Topics', desc: 'Select 3 topics from our curated list (Science, History, GK, Technology, etc.)' },
      { step: '2', title: 'Daily Prep', desc: '30 minutes of age-appropriate content — reading, videos, and key facts' },
      { step: '3', title: 'Take the Test', desc: '15-minute MCQ or descriptive quiz. Retake as many times as you want.' },
      { step: '4', title: 'Track Progress', desc: 'Detailed ratings, improvement graphs, and insights after each test.' },
    ],
  },
];

const BUNDLES = [
  {
    id: 'bundle_wa_ml',
    name: 'WhatsApp + Multilingual',
    includes: ['whatsapp', 'multilingual'],
    price: 1000,
    saving: 299,
    color: 'emerald',
    badge: 'Save ₹299',
  },
  {
    id: 'bundle_wa_ml_speak',
    name: 'WhatsApp + Multilingual + Speak',
    includes: ['whatsapp', 'multilingual', 'speak'],
    price: 1750,
    saving: 549,
    color: 'blue',
    badge: 'Save ₹549',
  },
  {
    id: 'bundle_preprimary_all',
    name: 'Pre-Primary Complete',
    subtitle: 'WhatsApp + Multilingual + Speak + Story',
    includes: ['whatsapp', 'multilingual', 'speak', 'story'],
    price: 2500,
    saving: 799,
    color: 'violet',
    badge: 'Best Value',
    highlight: true,
  },
  {
    id: 'bundle_k12',
    name: 'K-12 Excellence',
    subtitle: 'WhatsApp + Multilingual + Competitive Prep',
    includes: ['whatsapp', 'multilingual', 'competitive'],
    price: 2500,
    saving: 299,
    color: 'amber',
    badge: 'K-12 Special',
  },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string; button: string; light: string }> = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', button: 'bg-emerald-600 hover:bg-emerald-700', light: 'bg-emerald-100' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  badge: 'bg-indigo-100 text-indigo-700',  button: 'bg-indigo-600 hover:bg-indigo-700',  light: 'bg-indigo-100'  },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700',    button: 'bg-blue-600 hover:bg-blue-700',    light: 'bg-blue-100'    },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  badge: 'bg-violet-100 text-violet-700',  button: 'bg-violet-600 hover:bg-violet-700',  light: 'bg-violet-100'  },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',   button: 'bg-amber-600 hover:bg-amber-700',   light: 'bg-amber-100'   },
};

function PlanCard({ plan }: { plan: typeof PLANS[0] }) {
  const [expanded, setExpanded] = useState(false);
  const c = COLOR_MAP[plan.color];

  return (
    <div className={`bg-white rounded-2xl border-2 ${c.border} shadow-sm overflow-hidden`}>
      {/* Header */}
      <div className={`${c.bg} px-5 py-4`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{plan.icon}</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-neutral-900">{plan.name}</h3>
                {plan.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{plan.badge}</span>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">{plan.forAges}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black text-neutral-900">₹{plan.price.toLocaleString('en-IN')}</p>
            <p className="text-xs text-neutral-400">per year</p>
          </div>
        </div>
        <p className="text-sm text-neutral-600 mt-2">{plan.tagline}</p>
      </div>

      {/* Features */}
      <div className="px-5 py-4">
        <ul className="space-y-2">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
              <Check size={14} className={`${c.text} shrink-0 mt-0.5`} />
              {f}
            </li>
          ))}
        </ul>

        {/* How it works — expandable */}
        {plan.howItWorks && (
          <div className="mt-4">
            <button onClick={() => setExpanded(e => !e)}
              className={`flex items-center gap-1.5 text-xs font-semibold ${c.text} hover:opacity-80 transition-opacity`}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              How it works
            </button>
            {expanded && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {plan.howItWorks.map((step) => (
                  <div key={step.step} className={`${c.bg} rounded-xl p-3`}>
                    <div className={`w-6 h-6 rounded-full ${c.light} ${c.text} text-xs font-black flex items-center justify-center mb-1.5`}>
                      {step.step}
                    </div>
                    <p className={`text-xs font-bold ${c.text} mb-0.5`}>{step.title}</p>
                    <p className="text-xs text-neutral-500 leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-5 pb-5">
        <button className={`w-full py-3 ${c.button} text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2`}>
          <Star size={15} /> Subscribe — ₹{plan.price.toLocaleString('en-IN')}/year
        </button>
        <p className="text-center text-xs text-neutral-400 mt-2">Payment integration coming soon</p>
      </div>
    </div>
  );
}

function BundleCard({ bundle }: { bundle: typeof BUNDLES[0] }) {
  const c = COLOR_MAP[bundle.color];
  const planNames = bundle.includes.map(id => PLANS.find(p => p.id === id)?.icon + ' ' + PLANS.find(p => p.id === id)?.name).filter(Boolean);

  return (
    <div className={`bg-white rounded-2xl border-2 ${bundle.highlight ? 'border-violet-400 shadow-lg shadow-violet-100' : c.border} overflow-hidden relative`}>
      {bundle.highlight && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
      )}
      <div className={`${c.bg} px-5 py-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-neutral-900">{bundle.name}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{bundle.badge}</span>
            </div>
            {bundle.subtitle && <p className="text-xs text-neutral-500 mt-0.5">{bundle.subtitle}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black text-neutral-900">₹{bundle.price.toLocaleString('en-IN')}</p>
            <p className="text-xs text-emerald-600 font-semibold">Save ₹{bundle.saving}</p>
          </div>
        </div>
      </div>
      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-neutral-500 mb-2">Includes:</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {planNames.map((name, i) => (
            <span key={i} className={`text-xs px-2.5 py-1 rounded-full ${c.badge} font-medium`}>{name}</span>
          ))}
        </div>
        <button className={`w-full py-3 ${c.button} text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2`}>
          <Zap size={15} /> Get Bundle — ₹{bundle.price.toLocaleString('en-IN')}/year
        </button>
        <p className="text-center text-xs text-neutral-400 mt-2">Payment integration coming soon</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PremiumPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'individual' | 'bundles'>('individual');

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors">
          <ArrowLeft size={16} className="text-neutral-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-neutral-900">Premium for Parents</h1>
          <p className="text-xs text-neutral-400">Unlock powerful learning tools for your child</p>
        </div>
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-bold">
          ✨ Premium
        </span>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0f2417] to-[#1e5c3a] px-5 py-8 text-white">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-emerald-400 mb-2">Oakit Premium</p>
          <h2 className="text-2xl font-black mb-3" style={{ letterSpacing: '-0.03em' }}>
            Give your child the<br />learning edge
          </h2>
          <p className="text-sm text-white/70 leading-relaxed max-w-sm mx-auto">
            From speaking skills for toddlers to competitive exam prep for teens — premium tools designed for every stage of your child's journey.
          </p>
          <div className="flex items-center justify-center gap-4 mt-5 text-xs text-white/60">
            <span className="flex items-center gap-1"><Check size={12} className="text-emerald-400" /> No hidden fees</span>
            <span className="flex items-center gap-1"><Check size={12} className="text-emerald-400" /> Cancel anytime</span>
            <span className="flex items-center gap-1"><Check size={12} className="text-emerald-400" /> Instant access</span>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="px-4 py-4 max-w-3xl mx-auto">
        <div className="flex bg-neutral-100 rounded-xl p-1 gap-1">
          <button onClick={() => setActiveTab('individual')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'individual' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}>
            Individual Plans
          </button>
          <button onClick={() => setActiveTab('bundles')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'bundles' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}>
            Bundles 🔥
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-12 max-w-3xl mx-auto">
        {activeTab === 'individual' && (
          <div className="space-y-4">
            {/* Age group labels */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">All Ages</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>
            {PLANS.filter(p => !p.badge).map(plan => <PlanCard key={plan.id} plan={plan} />)}

            <div className="flex items-center gap-2 mt-6 mb-2">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Pre-Primary (Playgroup – UKG)</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>
            {PLANS.filter(p => p.badge === 'Pre-Primary').map(plan => <PlanCard key={plan.id} plan={plan} />)}

            <div className="flex items-center gap-2 mt-6 mb-2">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">K-12 (Grade 1 – 12)</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>
            {PLANS.filter(p => p.badge === 'K-12').map(plan => <PlanCard key={plan.id} plan={plan} />)}
          </div>
        )}

        {activeTab === 'bundles' && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2 mb-2">
              <Zap size={16} className="text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-700 font-medium">Bundles save you up to ₹799 compared to buying individually.</p>
            </div>
            {BUNDLES.map(bundle => <BundleCard key={bundle.id} bundle={bundle} />)}
          </div>
        )}

        {/* Pricing summary table */}
        <div className="mt-8 bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50">
            <p className="text-sm font-bold text-neutral-800">Quick Price Reference</p>
          </div>
          <div className="divide-y divide-neutral-100">
            {[
              { name: 'WhatsApp Notifications', price: '₹800/yr', tag: 'All ages' },
              { name: 'Multilingual Support', price: '₹499/yr', tag: 'All ages' },
              { name: 'Speak & Evaluate', price: '₹1,000/yr', tag: 'Pre-Primary' },
              { name: 'Story & Evaluate', price: '₹1,000/yr', tag: 'Pre-Primary' },
              { name: 'Competitive Exam Prep (3 topics)', price: '₹1,500/yr', tag: 'K-12' },
              { name: '─── Bundles ───', price: '', tag: '' },
              { name: 'WhatsApp + Multilingual', price: '₹1,000/yr', tag: 'Save ₹299' },
              { name: 'WhatsApp + Multilingual + Speak', price: '₹1,750/yr', tag: 'Save ₹549' },
              { name: 'Pre-Primary Complete (all 4)', price: '₹2,500/yr', tag: 'Best Value' },
              { name: 'K-12 Excellence (WA + ML + Comp)', price: '₹2,500/yr', tag: 'K-12 Special' },
            ].map((row, i) => (
              <div key={i} className={`flex items-center justify-between px-5 py-3 ${row.name.startsWith('─') ? 'bg-neutral-50' : ''}`}>
                <span className={`text-sm ${row.name.startsWith('─') ? 'text-neutral-400 font-medium' : 'text-neutral-700'}`}>{row.name}</span>
                <div className="flex items-center gap-2">
                  {row.tag && <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 font-medium">{row.tag}</span>}
                  {row.price && <span className="text-sm font-bold text-neutral-900">{row.price}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coming soon note */}
        <div className="mt-6 bg-neutral-100 rounded-2xl px-5 py-4 text-center">
          <p className="text-sm font-semibold text-neutral-700 mb-1">🚀 Launching Soon</p>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Payment integration is being set up. Subscribe to get notified when these features go live — early subscribers get 3 months free.
          </p>
          <button className="mt-3 px-5 py-2.5 bg-neutral-800 hover:bg-neutral-900 text-white text-sm font-bold rounded-xl transition-colors">
            Notify Me When Available
          </button>
        </div>
      </div>
    </div>
  );
}
