'use client';
import Link from 'next/link';
import { useState } from 'react';

const PHASES = [
  {
    years: '2026–2028',
    label: 'Phase 1',
    title: 'Foundation',
    subtitle: 'The School Operating System',
    color: '#1B4332',
    light: '#f0fdf4',
    target: '25 schools · 5,000+ children',
    story: 'Solving operational chaos in early childhood education — one school at a time.',
    items: ['AI Lesson Planner', 'Attendance & Coverage', 'Parent Communication', 'Child Portfolio', 'Reports & Analytics'],
  },
  {
    years: '2028–2030',
    label: 'Phase 2',
    title: 'School Intelligence',
    subtitle: 'Expand into K-12',
    color: '#1e40af',
    light: '#eff6ff',
    target: '250 schools · 100,000+ students',
    story: 'Becoming the education operating system that powers schools of every size.',
    items: ['Assessments & Exams', 'Homework Management', 'Student Analytics', 'Report Cards', 'AI Teacher Assistant'],
  },
  {
    years: '2030–2032',
    label: 'Phase 3',
    title: 'Parent Ecosystem',
    subtitle: 'Parenting in the AI Era',
    color: '#7c3aed',
    light: '#f5f3ff',
    target: '100,000+ parents',
    story: 'Extending beyond school management into family wellbeing and development.',
    items: ['Parenting Community', 'Child Development Resources', 'AI Parenting Assistant', 'Webinars & Events', 'Parenting Courses'],
  },
  {
    years: '2032–2034',
    label: 'Phase 4',
    title: 'Expert Marketplace',
    subtitle: 'Connect Need with Expertise',
    color: '#b45309',
    light: '#fffbeb',
    target: '10,000+ experts',
    story: 'Building the trusted marketplace connecting families with child development experts.',
    items: ['Expert Profiles', 'Courses & Workshops', '1:1 Consultations', 'Live Sessions', 'Content Library'],
  },
  {
    years: '2034–2036',
    label: 'Phase 5',
    title: 'Learning Marketplace',
    subtitle: 'Personalized Learning for Every Child',
    color: '#0f766e',
    light: '#f0fdfa',
    target: '500,000+ families',
    story: 'Supporting the complete child learning journey with AI-personalized paths.',
    items: ['Tutor Marketplace', 'Subject Tutoring', 'Personalized Learning Paths', 'AI Recommendations', 'Progress Tracking'],
  },
  {
    years: '2036+',
    label: 'Phase 6',
    title: 'Child Development OS',
    subtitle: 'One Platform. Every Stakeholder.',
    color: '#9f1239',
    light: '#fff1f2',
    target: '1 Million+ lives impacted',
    story: 'OKiT.ai is the operating system for childhood and parenting — globally.',
    items: ['Integrated Ecosystem', 'Corporate Partnerships', 'Analytics for Impact', 'Lifelong Learning Journey', 'Global Reach'],
  },
];

const PROBLEMS = [
  {
    icon: '📋',
    title: 'Operational Chaos in Schools',
    body: 'Preschools and primary schools run on WhatsApp groups, paper registers, and disconnected tools. Teachers spend more time on admin than teaching.',
  },
  {
    icon: '👨‍👩‍👧',
    title: 'Disconnected Parents',
    body: 'Parents receive almost no real-time insight into what their child learns daily. The gap between home and school creates anxiety and missed opportunities.',
  },
  {
    icon: '🧠',
    title: 'Mental Health Crisis Coming',
    body: 'Screen addiction, information overload, and competitive parenting are creating a generation of anxious children and stressed families. Schools are underprepared.',
  },
  {
    icon: '📊',
    title: 'Data Rich, Insight Poor',
    body: 'Thousands of data points per child exist but are never connected. No school today can tell you a child\'s holistic development story.',
  },
];

const WHAT_WE_BUILT = [
  { icon: '📅', label: 'AI Lesson Planner', desc: 'Auto-generates daily plans from curriculum PDF. Tracks coverage, flags gaps.' },
  { icon: '📸', label: 'Class Memory Feed', desc: 'Teachers upload photos/videos. Parents see class moments in real time.' },
  { icon: '🏆', label: 'Teacher Streaks', desc: 'Gamified consistency tracking. Teachers build streaks for daily plan completion.' },
  { icon: '🤖', label: 'Oakie — AI Assistant', desc: 'Parents ask "What did my child learn today?" Oakie answers with curriculum data.' },
  { icon: '📱', label: 'PWA — Works Offline', desc: 'Installed on phone like a native app. Works on 2G. No App Store needed.' },
  { icon: '📊', label: 'Principal Dashboard', desc: 'Coverage %, attendance, teacher activity — all visible at one glance.' },
  { icon: '💰', label: 'Fee Management', desc: 'Fee collection, receipts, salary, expense tracking — full financial module.' },
  { icon: '🎓', label: 'Student Portal', desc: 'Homework, quizzes, milestones, attendance — child has their own space.' },
];

const MARKET = [
  { label: 'Pre-K to K-12 schools in India', value: '1.5M+' },
  { label: 'Students enrolled annually', value: '260M+' },
  { label: 'EdTech market size 2025 (India)', value: '$7.5B' },
  { label: 'Projected EdTech market 2030', value: '$30B+' },
  { label: 'Early childhood segment (underserved)', value: '$2.5B' },
  { label: 'Parents willing to pay for child insights', value: '73%' },
];

export default function AboutPage() {
  const [activePhase, setActivePhase] = useState(0);
  const phase = PHASES[activePhase];

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-black text-xl text-neutral-900">OKiT</span>
          <span className="font-black text-xl text-amber-500">.ai</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-neutral-500">
          <a href="#problem" className="hover:text-neutral-900 transition-colors">The Problem</a>
          <a href="#solution" className="hover:text-neutral-900 transition-colors">Our Solution</a>
          <a href="#roadmap" className="hover:text-neutral-900 transition-colors">Roadmap</a>
          <a href="#market" className="hover:text-neutral-900 transition-colors">Market</a>
          <a href="#contact" className="hover:text-neutral-900 transition-colors">Connect</a>
        </div>
        <Link href="/login"
          className="px-4 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-700 transition-colors">
          See Live Demo
        </Link>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden px-6 pt-20 pb-24 text-center"
        style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 50%, #fffbeb 100%)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 text-xs font-semibold text-emerald-700 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live at Silver Oak Juniors, Bengaluru — Aug 2026
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-neutral-900 leading-tight mb-6">
            One Platform.<br />
            <span style={{ color: '#1B4332' }}>Every Stakeholder.</span><br />
            Every Stage of a Child's Growth.
          </h1>
          <p className="text-lg md:text-xl text-neutral-600 max-w-2xl mx-auto leading-relaxed mb-8">
            OKiT.ai is building the operating system for childhood development —
            connecting schools, parents, teachers, and experts through AI.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/login"
              className="px-8 py-4 text-white font-bold rounded-2xl text-base transition-all hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #1B4332, #2d6a4f)' }}>
              See the Live Product
            </Link>
            <a href="#roadmap"
              className="px-8 py-4 bg-white border border-neutral-200 text-neutral-800 font-bold rounded-2xl text-base hover:border-neutral-400 transition-colors">
              View Roadmap
            </a>
          </div>
        </div>
      </section>

      {/* ── MISSION ── */}
      <section className="px-6 py-10 text-center" style={{ background: '#1B4332' }}>
        <p className="text-lg md:text-2xl font-semibold text-white/90 max-w-3xl mx-auto leading-relaxed">
          Our Mission: To help every child become future-ready<br className="hidden md:block" />
          while staying rooted in values and humanity.
        </p>
      </section>

      {/* ── PROBLEM ── */}
      <section id="problem" className="px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-3">The Problem</p>
          <h2 className="text-3xl md:text-4xl font-black text-neutral-900 mb-4">
            The world is changing faster than education systems can keep up.
          </h2>
          <p className="text-neutral-500 max-w-2xl mx-auto text-base leading-relaxed">
            By 2030, 85% of jobs that today's preschoolers will hold don't exist yet.
            Yet schools still use paper registers. Parents are more anxious than ever.
            Children are more distracted. Something has to change.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {PROBLEMS.map((p, i) => (
            <div key={i} className="bg-neutral-50 border border-neutral-100 rounded-2xl p-6 hover:shadow-md transition-shadow">
              <div className="text-3xl mb-3">{p.icon}</div>
              <h3 className="text-base font-bold text-neutral-900 mb-2">{p.title}</h3>
              <p className="text-sm text-neutral-600 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p className="text-sm text-amber-800 font-medium leading-relaxed">
            <strong>The next decade will see:</strong> More working parents with less time,
            more data about their children with no way to understand it,
            more anxiety about screen time, career readiness, and social-emotional wellbeing.
            The family that has a trusted AI partner for their child's development will have
            a fundamental advantage.
          </p>
        </div>
      </section>

      {/* ── WHAT WE'VE BUILT ── */}
      <section id="solution" className="px-6 py-20" style={{ background: '#f8fafc' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-3">Already Built & Live</p>
            <h2 className="text-3xl md:text-4xl font-black text-neutral-900 mb-4">
              Not a pitch deck. A working product.
            </h2>
            <p className="text-neutral-500 max-w-2xl mx-auto text-base">
              OKiT.ai is live at Silver Oak Juniors, Bengaluru with real teachers, parents, and students using it daily since June 2026.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {WHAT_WE_BUILT.map((item, i) => (
              <div key={i} className="bg-white border border-neutral-100 rounded-2xl p-5 hover:shadow-md transition-all hover:-translate-y-0.5">
                <div className="text-2xl mb-3">{item.icon}</div>
                <p className="text-sm font-bold text-neutral-900 mb-1">{item.label}</p>
                <p className="text-xs text-neutral-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {[
              { n: '5+', label: 'Classes running live' },
              { n: '40+', label: 'Teacher completion streaks' },
              { n: '100+', label: 'Parents connected' },
              { n: '1000+', label: 'Daily plans generated by AI' },
              { n: '500+', label: 'Photos & videos shared' },
              { n: '0', label: 'Missed curriculum days (tracked)' },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-neutral-100 rounded-2xl p-5 text-center">
                <p className="text-3xl font-black" style={{ color: '#1B4332' }}>{s.n}</p>
                <p className="text-xs text-neutral-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROADMAP ── */}
      <section id="roadmap" className="px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-purple-600 mb-3">6-Phase Roadmap</p>
          <h2 className="text-3xl md:text-4xl font-black text-neutral-900 mb-4">
            From School OS to Child Development Ecosystem
          </h2>
          <p className="text-neutral-500 max-w-2xl mx-auto text-base">
            Each phase is a natural extension of the previous — building trust, data, and network effects at every step.
          </p>
        </div>

        {/* Phase tabs */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {PHASES.map((p, i) => (
            <button key={i} onClick={() => setActivePhase(i)}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: activePhase === i ? p.color : '#f8fafc',
                color: activePhase === i ? 'white' : '#6b7280',
                border: `2px solid ${activePhase === i ? p.color : '#e5e7eb'}`,
              }}>
              {p.label}: {p.years}
            </button>
          ))}
        </div>

        {/* Active phase detail */}
        <div className="rounded-2xl p-8 border transition-all" style={{ background: phase.light, borderColor: phase.color + '33' }}>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: phase.color }}>{phase.label} · {phase.years}</p>
              <h3 className="text-2xl font-black text-neutral-900">{phase.title}</h3>
              <p className="text-base text-neutral-600 mt-1">{phase.subtitle}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500 mb-1">Target</p>
              <p className="text-sm font-bold text-neutral-800">{phase.target}</p>
            </div>
          </div>
          <div className="bg-white/70 rounded-xl p-4 mb-5">
            <p className="text-sm font-semibold text-neutral-700 italic">"{phase.story}"</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {phase.items.map((item, i) => (
              <div key={i} className="bg-white rounded-xl px-3 py-2 text-xs font-medium text-neutral-700 text-center border border-neutral-100">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONNECTED ECOSYSTEM ── */}
      <section className="px-6 py-20" style={{ background: '#1B4332' }}>
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">The Ecosystem</p>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            Every stakeholder in a child's journey.<br />One intelligent platform.
          </h2>
          <p className="text-emerald-100/80 max-w-2xl mx-auto text-base mb-10">
            OKiT.ai is the connective tissue between every party that influences a child's development.
            Data + AI + Trust = Impact.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { role: 'Schools', action: 'Manage. Educate. Grow.' },
              { role: 'Parents', action: 'Guided. Supported. Empowered.' },
              { role: 'Teachers', action: 'Enabled. Equipped. Inspired.' },
              { role: 'Experts', action: 'Share Knowledge. Create Impact.' },
              { role: 'Students', action: 'Learn. Grow. Thrive.' },
              { role: 'Corporates', action: 'Partner. Empower. Give Back.' },
            ].map((s, i) => (
              <div key={i} className="bg-white/10 border border-white/20 rounded-2xl px-6 py-4 text-center min-w-[140px]">
                <p className="text-white font-bold text-sm">{s.role}</p>
                <p className="text-emerald-200/70 text-xs mt-1">{s.action}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 grid md:grid-cols-4 gap-4">
            {[
              { icon: '🌱', label: 'Future-ready children' },
              { icon: '💪', label: 'Stronger families' },
              { icon: '👩‍🏫', label: 'Empowered educators' },
              { icon: '🏛️', label: 'Better society' },
            ].map((imp, i) => (
              <div key={i} className="bg-white/10 rounded-2xl p-4 text-center">
                <div className="text-2xl mb-2">{imp.icon}</div>
                <p className="text-white text-xs font-medium">{imp.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARKET ── */}
      <section id="market" className="px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Market Opportunity</p>
          <h2 className="text-3xl md:text-4xl font-black text-neutral-900 mb-4">
            A massive, underserved market.
          </h2>
          <p className="text-neutral-500 max-w-2xl mx-auto text-base">
            India's K-12 EdTech market is the second largest in the world. The early childhood segment — our entry point — is the least digitized and most underserved.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {MARKET.map((m, i) => (
            <div key={i} className="bg-neutral-50 border border-neutral-100 rounded-2xl p-6">
              <p className="text-2xl font-black text-blue-700 mb-1">{m.value}</p>
              <p className="text-sm text-neutral-600">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl p-6">
          <p className="text-sm text-blue-900 leading-relaxed">
            <strong>Why now:</strong> Post-pandemic, schools are actively looking for tech solutions. 
            Parents are demanding more transparency. AI is making personalized education economically feasible for the first time. 
            The network effects of connecting school + parent + expert create a defensible moat that grows stronger with every user.
          </p>
        </div>
      </section>

      {/* ── UNIQUE ADVANTAGE ── */}
      <section className="px-6 py-20" style={{ background: '#fafafa' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-3">Why OKiT Wins</p>
            <h2 className="text-3xl md:text-4xl font-black text-neutral-900">What makes us different.</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: 'Bottom-up trust',
                body: 'We enter through schools, earn daily usage from teachers, and build trust before expanding to families. Trust is the hardest asset to replicate.',
              },
              {
                title: 'Daily habit product',
                body: 'Teachers use OKiT every single school day — not quarterly. 40+ day streaks already. Daily usage creates data density that no competitor can catch up to.',
              },
              {
                title: 'AI on real school data',
                body: 'Our AI (Oakie) is trained on actual curriculum, attendance, and completion data from real classrooms. Not generic chatGPT responses — contextualized insight.',
              },
              {
                title: 'Franchise-ready architecture',
                body: 'Multi-tenant from day one. A franchise chain can manage 50 schools with one login. Built for scale, not retrofitted for it.',
              },
              {
                title: 'Emotional + Academic',
                body: 'We track not just what a child learns but milestones, observations, and behavioral patterns. The first platform that bridges academic and emotional development.',
              },
              {
                title: 'Built for India\'s reality',
                body: 'Works on 2G, installable as PWA, regional language ready. Not a Silicon Valley product retrofitted for India — designed for India from scratch.',
              },
            ].map((adv, i) => (
              <div key={i} className="bg-white border border-neutral-100 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="w-8 h-8 rounded-xl mb-3 flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: '#1B4332' }}>{i + 1}</div>
                <h3 className="text-base font-bold text-neutral-900 mb-2">{adv.title}</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">{adv.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className="px-6 py-20 text-center" style={{ background: '#1B4332' }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-4">Get Involved</p>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            Let's build the future of childhood together.
          </h2>
          <p className="text-emerald-100/80 text-base leading-relaxed mb-8">
            We're looking for mentors, advisors, and early investors who believe that 
            investing in a child's first years is the highest-leverage investment in society's future.
            If that resonates with you — let's talk.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="mailto:info@silveroakjuniors.in"
              className="px-8 py-4 bg-white text-neutral-900 font-bold rounded-2xl text-sm hover:bg-neutral-100 transition-colors">
              Get in Touch
            </a>
            <Link href="/login"
              className="px-8 py-4 bg-white/10 border border-white/30 text-white font-bold rounded-2xl text-sm hover:bg-white/20 transition-colors">
              See Live Demo
            </Link>
          </div>
          <p className="text-emerald-200/50 text-xs mt-8">
            OKiT.ai · Building at Silver Oak Juniors, Bengaluru · 2026
          </p>
        </div>
      </section>
    </div>
  );
}
