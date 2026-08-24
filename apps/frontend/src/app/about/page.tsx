'use client';
import Link from 'next/link';
import { useState } from 'react';

/* ── Revenue projections ─────────────────────────────────────────────────── */
// IMPORTANT: These are BARE MINIMUM conservative projections for School Management SaaS only.
// Multiple go-to-market strategies (parent premium, expert marketplace, franchise licensing,
// corporate partnerships, learning marketplace) are not included — actual revenue potential
// is significantly higher. Numbers are indicative, not audited.
const REVENUE = [
  { year:'FY 2026–27', schools:10,  studentsK:'~1K',  arr:'₹6L',    mrr:'₹50K',  basis:'10 schools × ₹5,000/mo', note:'Pilot & proof-of-concept' },
  { year:'FY 2027–28', schools:50,  studentsK:'~5K',  arr:'₹42L',   mrr:'₹3.5L', basis:'50 schools × ₹7,000/mo', note:'Word-of-mouth + 1 franchise' },
  { year:'FY 2028–29', schools:150, studentsK:'~20K', arr:'₹1.8Cr', mrr:'₹15L',  basis:'150 schools × ₹10,000/mo', note:'Franchise expansion, Karnataka' },
  { year:'FY 2029–30', schools:400, studentsK:'~60K', arr:'₹6.4Cr', mrr:'₹53L',  basis:'400 schools × ₹13,000/mo', note:'Multi-state, K-12 begins' },
  { year:'FY 2030–31', schools:1000,studentsK:'~1.5L',arr:'₹18Cr',  mrr:'₹1.5Cr',basis:'1,000 schools × ₹15,000/mo', note:'Pan-India, network effects' },
];

/* ── 6-phase roadmap ─────────────────────────────────────────────────────── */
const PHASES = [
  { n:'1', years:'2026–28', color:'#1B4332', bg:'#f0fdf4',
    title:'School OS', sub:'Foundation',
    target:'25 schools · 5K children',
    story:'Solving operational chaos in early childhood education.',
    items:['AI Lesson Planner','Attendance Tracking','Parent Feed','Coverage Analytics','Fee Module'],
  },
  { n:'2', years:'2028–30', color:'#1e40af', bg:'#eff6ff',
    title:'School Intelligence', sub:'K-12 expansion',
    target:'250 schools · 100K students',
    story:'The education operating system that powers schools of every size.',
    items:['Assessments & Exams','Homework Management','Student Analytics','Report Cards','AI Teacher Assistant'],
  },
  { n:'3', years:'2030–32', color:'#7c3aed', bg:'#f5f3ff',
    title:'Parent Ecosystem', sub:'Parenting in the AI Era',
    target:'100,000+ parents',
    story:'Extending beyond school management into family wellbeing.',
    items:['Parenting Community','Child Dev Resources','AI Parenting Assistant','Webinars & Events','Parenting Courses'],
  },
  { n:'4', years:'2032–34', color:'#b45309', bg:'#fffbeb',
    title:'Expert Marketplace', sub:'Connect Need with Expertise',
    target:'10,000+ experts',
    story:'Trusted marketplace connecting families with child development experts.',
    items:['Expert Profiles','Courses & Workshops','1:1 Consultations','Live Sessions','Content Library'],
  },
  { n:'5', years:'2034–36', color:'#0f766e', bg:'#f0fdfa',
    title:'Learning Marketplace', sub:'Personalized Learning',
    target:'500K+ families',
    story:'AI-personalized learning paths for every child.',
    items:['Tutor Marketplace','Subject Tutoring','Personalized Paths','AI Recommendations','Progress Tracking'],
  },
  { n:'6', years:'2036+', color:'#9f1239', bg:'#fff1f2',
    title:'Child Development OS', sub:'One Platform. Every Stakeholder.',
    target:'1M+ lives impacted',
    story:'oakit.ai — the operating system for childhood, globally.',
    items:['Integrated Ecosystem','Corporate Partnerships','Analytics for Impact','Lifelong Learning','Global Reach'],
  },
];

/* ── Live product features ───────────────────────────────────────────────── */
const FEATURES = [
  { icon:'📅', title:'AI Lesson Planner',          desc:'Curriculum PDF → daily plans auto-generated. Tracks coverage, flags gaps, carries forward missed topics.' },
  { icon:'📸', title:'Class Memory Feed',           desc:'Teachers post photos & videos. Parents see class moments. Organised by date/event with likes & comments.' },
  { icon:'🎬', title:'Google Drive Integration',    desc:'All media saved to Drive in smart folders: ClassName/Date/Photos & Videos. Client-side compression before upload.' },
  { icon:'💬', title:'WhatsApp Integration',        desc:'Automated notifications to parents on WhatsApp — homework, attendance alerts, important announcements.' },
  { icon:'🤖', title:'Oakie — AI Assistant',        desc:'"What did my child learn today?" Oakie answers from real curriculum data — specific to the child\'s class.' },
  { icon:'🏆', title:'Teacher Streaks',             desc:'Gamified daily consistency. Teachers earn streaks for plan completion. 35+ day streaks live in production.' },
  { icon:'📊', title:'Principal Dashboard',         desc:'Coverage %, attendance, teacher activity, streaks — live school health at one glance. No manual reports.' },
  { icon:'💰', title:'Full Financial Module',       desc:'Fee collection, receipts, salary, expense tracking, financial reports. Replaces 3 separate paid tools.' },
  { icon:'🎓', title:'Student Portal',              desc:'Homework, quizzes, milestones, attendance — every child has their own dedicated space.' },
  { icon:'📱', title:'PWA — No App Store',          desc:'Installable on any phone like a native app. Works on 2G. No Google Play or App Store approval needed.' },
  { icon:'👨‍👩‍👧', title:'Parent Communication',      desc:'Daily feed, attendance alerts, teacher messages, homework, milestone updates — all in one parent view.' },
  { icon:'🏫', title:'Multi-tenant Franchise',      desc:'A franchise chain manages multiple schools from one admin login. Built for scale from day one.' },
];

/* ── Traction stats ──────────────────────────────────────────────────────── */
const STATS = [
  {n:'9+',   l:'Classes live'},
  {n:'35+',  l:'Day teacher streaks'},
  {n:'450+',  l:'Parents connected'},
  {n:'18+', l:'Teachers OnBoarded'},
  {n:'5000+', l:'Photos & videos shared'},
  {n:'100%', l:'Curriculum tracked daily'},
];

/* ── Why we win ─────────────────────────────────────────────────────────── */
const MOATS = [
  { icon:'🔄', title:'Daily Habit',       desc:'Used every single school day. 40+ day teacher streaks. Daily usage = data density competitors cannot replicate.' },
  { icon:'🏗️', title:'Bottom-up Trust',   desc:'Earned from teachers → parents → experts. Trust is the hardest asset to acquire. We build it daily.' },
  { icon:'🧠', title:'Contextual AI',     desc:'Oakie is trained on real curriculum data. Every answer is specific to the child\'s actual class, not generic.' },
  { icon:'🏢', title:'Franchise-ready',   desc:'Multi-tenant from day one. A franchise manages 50 schools with one login. Built for scale, not retrofitted.' },
  { icon:'🇮🇳', title:'India-first',       desc:'Works on 2G, regional language ready, ₹500/school pricing. Designed for India — not Silicon Valley.' },
  { icon:'❤️', title:'Emotional + Academic', desc:'First platform bridging academic progress with milestones, observations, and emotional development tracking.' },
];

export default function AboutPage() {
  const [activePhase, setActivePhase] = useState(0);
  const ph = PHASES[activePhase];

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily:"'Inter',-apple-system,sans-serif" }}>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-neutral-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/app-icon.svg" alt="oakit.ai" width={32} height={32} style={{borderRadius:8}} />
          <span className="font-black text-lg text-neutral-900">oakit<span style={{color:'#E8960C'}}>.ai</span></span>
        </div>
        <div className="hidden md:flex items-center gap-5 text-sm text-neutral-500 font-medium">
          {[['#problem','Problem'],['#built','Product'],['#roadmap','Roadmap'],['#revenue','Revenue'],['#contact','Connect']].map(([h,l])=>(
            <a key={h} href={h} className="hover:text-neutral-900 transition-colors">{l}</a>
          ))}
        </div>
        <Link href="/login" className="px-4 py-2 text-white text-sm font-bold rounded-xl transition-all hover:opacity-90"
          style={{background:'linear-gradient(135deg,#1B4332,#2d6a4f)'}}>
          Live Demo
        </Link>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative px-6 pt-16 pb-20 overflow-hidden"
        style={{background:'linear-gradient(160deg,#f0fdf4 0%,#fff 45%,#fffbeb 100%)'}}>
        <div className="max-w-5xl mx-auto text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <img src="/app-icon.svg" alt="oakit.ai" width={72} height={72} style={{borderRadius:18, boxShadow:'0 8px 32px rgba(27,67,50,0.3)'}} />
          </div>
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 text-xs font-semibold text-emerald-700 mb-5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live at Silver Oak Juniors · Bengaluru · August 2026
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-neutral-900 leading-[1.05] mb-5">
            One Platform.<br />
            <span style={{color:'#1B4332'}}>Every Stakeholder.</span><br />
            <span style={{color:'#E8960C'}}>Every Stage.</span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-600 max-w-xl mx-auto leading-relaxed mb-8">
            oakit.ai is building the <strong>operating system for childhood development</strong> — connecting schools, parents, teachers, and experts through AI.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/login" className="px-8 py-4 text-white font-bold rounded-2xl text-base hover:opacity-90 transition-all shadow-lg shadow-emerald-900/20"
              style={{background:'linear-gradient(135deg,#1B4332,#2d6a4f)'}}>
              See Live Product →
            </Link>
            <a href="#revenue" className="px-8 py-4 bg-white border-2 border-amber-300 text-amber-800 font-bold rounded-2xl text-base hover:border-amber-500 transition-colors">
              Revenue Model
            </a>
          </div>
        </div>

        {/* Mission banner */}
        <div className="max-w-3xl mx-auto mt-14 rounded-2xl p-5 text-center" style={{background:'#1B4332'}}>
          <p className="text-white/90 font-semibold text-base leading-relaxed">
            Mission: To help every child become future-ready while staying rooted in values and humanity.
          </p>
        </div>
      </section>

      {/* ── THE PROBLEM ──────────────────────────────────────────────────── */}
      <section id="problem" className="px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-3">The Problem We're Solving</p>
          <h2 className="text-3xl md:text-4xl font-black text-neutral-900 mb-4">
            The world changes faster than<br />education systems can adapt.
          </h2>
        </div>

        {/* 4 visual problem cards */}
        <div className="grid md:grid-cols-2 gap-5 mb-10">
          {[
            { icon:'📋', color:'#fef2f2', border:'#fecaca', n:'1.5M+', label:'Schools in India still run on paper registers & WhatsApp groups', sub:'No digitization. No data. No insight.' },
            { icon:'👨‍👩‍👧', color:'#fff7ed', border:'#fed7aa', n:'73%', label:'Parents want real-time insight into what their child learns', sub:'They get zero. A weekly note at best.' },
            { icon:'📱', color:'#f0f9ff', border:'#bae6fd', n:'7 hrs', label:'Average daily screen time for a child in 2025', sub:'Schools unprepared. Parents anxious. No AI solution.' },
            { icon:'🔗', color:'#fdf4ff', border:'#e9d5ff', n:'0', label:'Platforms that connect school + parent + expert + student', sub:'Every stakeholder is siloed. No one sees the full picture.' },
          ].map((p,i)=>(
            <div key={i} className="rounded-2xl border-2 p-6 flex gap-4" style={{background:p.color,borderColor:p.border}}>
              <div className="text-4xl shrink-0">{p.icon}</div>
              <div>
                <p className="text-3xl font-black text-neutral-900 leading-none mb-1">{p.n}</p>
                <p className="text-sm font-semibold text-neutral-800 mb-1">{p.label}</p>
                <p className="text-xs text-neutral-500">{p.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Future problem */}
        <div className="bg-neutral-900 rounded-2xl p-8 text-center">
          <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-3">The Next 10 Years</p>
          <h3 className="text-white text-xl font-bold mb-4">The coming crisis we are positioned to solve</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {icon:'😰', title:'Anxious Families', desc:'More dual-income households, less time with children, rising anxiety about screen addiction and career readiness.'},
              {icon:'📊', title:'Data Overload', desc:'Thousands of data points per child — test scores, attendance, behavior — but no platform to turn data into insight.'},
              {icon:'🤯', title:'Mental Health Crisis', desc:'1 in 4 children will face mental health challenges by 2030. Schools and parents have no early warning system.'},
            ].map((f,i)=>(
              <div key={i} className="bg-white/10 rounded-xl p-5 text-left">
                <div className="text-2xl mb-2">{f.icon}</div>
                <p className="text-white font-bold text-sm mb-1">{f.title}</p>
                <p className="text-white/60 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCT — WHAT WE'VE BUILT ───────────────────────────────────── */}
      <section id="built" className="px-6 py-20" style={{background:'#f8fafc'}}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-3">Live Product · Not a Prototype</p>
            <h2 className="text-3xl md:text-4xl font-black text-neutral-900 mb-4">
              Already working.<br />Real teachers. Real parents. Real data.
            </h2>
            <p className="text-neutral-500 max-w-2xl mx-auto">
              oakit.ai has been live at Silver Oak Juniors since June 2026. Every feature below is in daily production use.
            </p>
          </div>

          {/* Feature grid — 12 features */}
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
            {FEATURES.map((f,i)=>(
              <div key={i} className="bg-white rounded-2xl p-5 border border-neutral-100 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <div className="text-3xl mb-3">{f.icon}</div>
                <p className="text-sm font-bold text-neutral-900 mb-1.5">{f.title}</p>
                <p className="text-xs text-neutral-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Live traction numbers */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {STATS.map((s,i)=>(
              <div key={i} className="bg-white border border-neutral-100 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black" style={{color:'#1B4332'}}>{s.n}</p>
                <p className="text-[10px] text-neutral-500 mt-0.5 leading-tight">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONNECTED ECOSYSTEM VISUAL ───────────────────────────────────── */}
      <section className="px-6 py-20" style={{background:'#1B4332'}}>
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">The Ecosystem</p>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
            Every stakeholder. One platform. One data layer.
          </h2>
          <p className="text-emerald-100/70 text-base mb-12 max-w-2xl mx-auto">
            oakit.ai sits at the centre of every party that influences a child's development. Data flows between them. AI makes sense of it.
          </p>

          {/* Hub and spoke — grid layout, no overflow */}
          <div className="flex flex-col items-center gap-6 mb-10">
            {/* Top row */}
            <div className="flex justify-center gap-16">
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-2xl">🏫</div>
                <p className="text-white/80 text-xs font-semibold">Schools</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-2xl">👨‍👩‍👧</div>
                <p className="text-white/80 text-xs font-semibold">Parents</p>
              </div>
            </div>

            {/* Middle row: Expert | HUB | Teachers */}
            <div className="flex items-center justify-center gap-10">
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-2xl">🧑‍💼</div>
                <p className="text-white/80 text-xs font-semibold">Experts</p>
              </div>

              {/* Center hub */}
              <div className="w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-2xl shrink-0"
                style={{background:'linear-gradient(135deg,#E8960C,#f59e0b)'}}>
                <img src="/app-icon.svg" alt="oakit.ai" width={44} height={44} style={{borderRadius:10, marginBottom:4}} />
                <p className="text-white text-[10px] font-black">oakit.ai</p>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-2xl">👩‍🏫</div>
                <p className="text-white/80 text-xs font-semibold">Teachers</p>
              </div>
            </div>

            {/* Bottom row */}
            <div className="flex justify-center gap-16">
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-2xl">🎓</div>
                <p className="text-white/80 text-xs font-semibold">Students</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-2xl">🏢</div>
                <p className="text-white/80 text-xs font-semibold">Corporates</p>
              </div>
            </div>
          </div>

          {/* Impact pillars */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-16">
            {[
              {icon:'🌱',title:'Future-ready children',desc:'Curriculum + emotional growth tracked from day 1'},
              {icon:'💪',title:'Stronger families',desc:'Parents stay informed, connected, and empowered'},
              {icon:'👩‍🏫',title:'Empowered educators',desc:'Less admin, more teaching, recognised work'},
              {icon:'🏛️',title:'Better society',desc:'Data + AI driving early childhood policy insights'},
            ].map((imp,i)=>(
              <div key={i} className="bg-white/10 border border-white/20 rounded-2xl p-5">
                <div className="text-2xl mb-2">{imp.icon}</div>
                <p className="text-white font-bold text-xs mb-1">{imp.title}</p>
                <p className="text-white/50 text-[10px] leading-relaxed">{imp.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROADMAP ──────────────────────────────────────────────────────── */}
      <section id="roadmap" className="px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-purple-600 mb-3">6-Phase Roadmap · 2026 → 2036+</p>
          <h2 className="text-3xl md:text-4xl font-black text-neutral-900 mb-4">
            From School OS → Child Development Ecosystem
          </h2>
          <p className="text-neutral-500 max-w-2xl mx-auto">
            Each phase builds on the previous. Trust, data, and network effects compound at every step.
          </p>
        </div>

        {/* Phase timeline bar */}
        <div className="flex overflow-x-auto gap-0 mb-0 pb-0">
          {PHASES.map((p,i)=>(
            <button key={i} onClick={()=>setActivePhase(i)}
              className="flex-1 min-w-[110px] py-3 px-2 text-center transition-all border-b-4 text-xs font-bold"
              style={{
                borderColor: activePhase===i ? p.color : '#e5e7eb',
                color: activePhase===i ? p.color : '#9ca3af',
                background: activePhase===i ? p.bg : 'white',
              }}>
              <div className="text-base mb-0.5">{['🏗️','🧠','👨‍👩‍👧','🏪','📚','🌍'][i]}</div>
              <div>{p.title}</div>
              <div className="font-normal opacity-70 text-[9px] mt-0.5">{p.years}</div>
            </button>
          ))}
        </div>

        {/* Active phase detail */}
        <div className="rounded-b-2xl rounded-tr-2xl border-2 p-8 transition-all"
          style={{background:ph.bg, borderColor:ph.color+'44'}}>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-white mb-2"
                style={{background:ph.color}}>Phase {ph.n} · {ph.years}</div>
              <h3 className="text-2xl font-black text-neutral-900">{ph.title}</h3>
              <p className="text-neutral-600 mt-1">{ph.sub}</p>
            </div>
            <div className="text-right bg-white rounded-xl px-4 py-3 border border-neutral-100">
              <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Target</p>
              <p className="text-sm font-bold text-neutral-800">{ph.target}</p>
            </div>
          </div>
          <div className="bg-white/80 rounded-xl p-4 mb-5 border border-neutral-100">
            <p className="text-sm font-semibold text-neutral-700 italic">"{ph.story}"</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ph.items.map((item,i)=>(
              <span key={i} className="bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-xs font-medium text-neutral-700">
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Timeline connector dots */}
        <div className="flex items-center justify-between mt-4 px-4">
          {PHASES.map((_,i)=>(
            <div key={i} className="flex flex-col items-center gap-1 cursor-pointer" onClick={()=>setActivePhase(i)}>
              <div className="w-3 h-3 rounded-full transition-all"
                style={{background: i <= activePhase ? '#1B4332' : '#e5e7eb', transform: i === activePhase ? 'scale(1.4)' : 'scale(1)'}} />
            </div>
          ))}
        </div>
      </section>

      {/* ── REVENUE MODEL ────────────────────────────────────────────────── */}
      <section id="revenue" className="px-6 py-20" style={{background:'#f8fafc'}}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-3">Revenue Projections</p>
            <h2 className="text-3xl md:text-4xl font-black text-neutral-900 mb-4">
              Conservative. Calculated. Compelling.
            </h2>
          </div>

          {/* Disclaimer box */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 mb-8 flex gap-3">
            <div className="text-2xl shrink-0 mt-0.5">⚠️</div>
            <div>
              <p className="text-sm font-bold text-amber-900 mb-1">Important Note on Revenue Projections</p>
              <p className="text-xs text-amber-800 leading-relaxed">
                These numbers represent the <strong>absolute bare minimum</strong> — modelling only School Management SaaS subscriptions.
                Revenue has <strong>not yet been formally calculated or audited</strong>.
                We have multiple go-to-market strategies including parent premium subscriptions, expert marketplace commissions,
                franchise licensing fees, corporate CSR partnerships, and a learning marketplace — <strong>none of which are included here</strong>.
                Actual revenue potential is significantly higher than what is shown.
              </p>
            </div>
          </div>

          {/* Revenue table */}
          <div className="overflow-x-auto mb-8">
            <table className="w-full bg-white rounded-2xl overflow-hidden shadow-sm border border-neutral-100">
              <thead>
                <tr style={{background:'#1B4332'}}>
                  {['Year','Schools','Students','Monthly Recurring','Annual Revenue','Pricing Basis','Phase'].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-white/80 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {REVENUE.map((r,i)=>(
                  <tr key={i} className={i%2===0 ? 'bg-white' : 'bg-neutral-50'}>
                    <td className="px-4 py-3 text-sm font-bold text-neutral-800 whitespace-nowrap">{r.year}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{r.schools.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{r.studentsK}</td>
                    <td className="px-4 py-3 text-sm font-bold text-neutral-700">{r.mrr}</td>
                    <td className="px-4 py-3 text-base font-black whitespace-nowrap" style={{color:'#1B4332'}}>{r.arr}</td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{r.basis}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 whitespace-nowrap">{r.note}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Growth visual */}
          <div className="bg-white rounded-2xl border border-neutral-100 p-6 mb-8">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-4">ARR Growth (School SaaS only — bare minimum)</p>
            <div className="flex items-end gap-3 h-32">
              {REVENUE.map((r,i)=>{
                const heights = [8, 18, 36, 64, 100];
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <p className="text-[9px] font-bold text-neutral-600">{r.arr}</p>
                    <div className="w-full rounded-t-lg transition-all" style={{height:`${heights[i]}%`, background:`linear-gradient(to top, #1B4332, #2d6a4f)`}} />
                    <p className="text-[8px] text-neutral-400 text-center leading-tight">{r.year.replace('FY ','')}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Revenue streams — future potential */}
          <div>
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-4 text-center">Future Revenue Streams (Not in projections above)</p>
            <div className="grid md:grid-cols-4 gap-4">
              {[
                {stream:'Parent Premium',       price:'₹299–₹499/mo',   who:'Parents',   color:'#7c3aed', when:'Phase 3 · 2030+'},
                {stream:'Expert Marketplace',   price:'15–20% commission',who:'Experts', color:'#b45309', when:'Phase 4 · 2032+'},
                {stream:'Franchise Licensing',  price:'₹2–5L/school',    who:'Franchise chains', color:'#0f766e', when:'Phase 2 · 2028+'},
                {stream:'Corporate / CSR',      price:'₹10L–₹1Cr/deal',  who:'Corporates', color:'#9f1239', when:'Phase 5+ · 2034+'},
              ].map((s,i)=>(
                <div key={i} className="bg-white rounded-2xl p-5 border-2" style={{borderColor:s.color+'33'}}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold" style={{color:s.color}}>{s.stream}</p>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white" style={{background:s.color}}>{s.when.split('·')[0]}</span>
                  </div>
                  <p className="text-base font-black text-neutral-900 mb-1">{s.price}</p>
                  <p className="text-[10px] text-neutral-500">{s.who} · {s.when.split('·')[1]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY WE WIN ───────────────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-3">Competitive Moats</p>
          <h2 className="text-3xl md:text-4xl font-black text-neutral-900">What makes oakit.ai defensible.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {MOATS.map((m,i)=>(
            <div key={i} className="bg-neutral-50 border border-neutral-100 rounded-2xl p-6 hover:shadow-md transition-all">
              <div className="text-3xl mb-3">{m.icon}</div>
              <p className="text-sm font-bold text-neutral-900 mb-2">{m.title}</p>
              <p className="text-xs text-neutral-600 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── MARKET SIZE ──────────────────────────────────────────────────── */}
      <section className="px-6 py-16" style={{background:'#f8fafc'}}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Market Size</p>
            <h2 className="text-3xl font-black text-neutral-900">A massive, underserved market.</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              {v:'1.5M+', l:'K-12 schools in India'},
              {v:'260M+', l:'Students enrolled annually'},
              {v:'$7.5B', l:'EdTech market size 2025'},
              {v:'$30B+', l:'Projected EdTech market 2030'},
              {v:'$2.5B', l:'Early childhood segment (underserved)'},
              {v:'73%',   l:'Parents willing to pay for child insights'},
            ].map((m,i)=>(
              <div key={i} className="bg-white border border-neutral-100 rounded-2xl p-5 text-center">
                <p className="text-2xl font-black text-blue-700 mb-1">{m.v}</p>
                <p className="text-xs text-neutral-500">{m.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section id="contact" className="px-6 py-24 text-center" style={{background:'linear-gradient(135deg,#1B4332,#0f2b1f)'}}>
        <div className="max-w-2xl mx-auto">
          <img src="/app-icon.svg" alt="oakit.ai" width={56} height={56} style={{borderRadius:14, margin:'0 auto 20px', display:'block', boxShadow:'0 8px 24px rgba(0,0,0,0.3)'}} />
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-4">Let's Build Together</p>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            Looking for mentors, advisors<br />and early believers.
          </h2>
          <p className="text-emerald-100/70 text-base leading-relaxed mb-8 max-w-lg mx-auto">
            If you believe that investing in a child's first years is the highest-leverage investment in society's future — let's talk.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <a href="mailto:info@silveroakjuniors.in"
              className="px-8 py-4 bg-amber-400 text-neutral-900 font-black rounded-2xl text-sm hover:bg-amber-300 transition-colors">
              Get in Touch
            </a>
            <Link href="/login"
              className="px-8 py-4 bg-white/10 border border-white/30 text-white font-bold rounded-2xl text-sm hover:bg-white/20 transition-colors">
              See Live Demo
            </Link>
          </div>
          <p className="text-emerald-200/40 text-xs">
            oakit.ai · Silver Oak Juniors · Bengaluru · 2026 · oakit.silveroakjuniors.in
          </p>
        </div>
      </section>
    </div>
  );
}

