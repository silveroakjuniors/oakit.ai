'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronRight, ChevronLeft, Star } from 'lucide-react';

// Real Unsplash photos — children learning, reading, studying
const SLIDES = [
  {
    id: 'speak',
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80&fit=crop',
    imageAlt: 'Child learning and speaking',
    badge: '🗣️ Speak & Evaluate',
    badgeColor: 'bg-blue-500',
    headline: 'Build your child\'s voice',
    subline: 'Weekly speaking topics narrated in a warm voice. Your child listens, learns, then speaks back — we evaluate and rate their progress.',
    highlight: 'Pre-Primary · ₹1,000/year',
    highlightColor: 'bg-blue-100 text-blue-800',
    cta: 'Learn more',
    ctaColor: 'bg-blue-600 hover:bg-blue-700',
  },
  {
    id: 'story',
    image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=80&fit=crop',
    imageAlt: 'Child reading a story book',
    badge: '📖 Story & Evaluate',
    badgeColor: 'bg-violet-500',
    headline: '25 stories that grow with your child',
    subline: 'Curated age-appropriate stories spread across the year. Children listen, retell, and for LKG/UKG — read aloud. We track their reading journey.',
    highlight: 'Pre-Primary · ₹1,000/year',
    highlightColor: 'bg-violet-100 text-violet-800',
    cta: 'Explore stories',
    ctaColor: 'bg-violet-600 hover:bg-violet-700',
  },
  {
    id: 'competitive',
    image: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800&q=80&fit=crop',
    imageAlt: 'Student studying and preparing',
    badge: '🏆 Competitive Exam Prep',
    badgeColor: 'bg-amber-500',
    headline: 'Start preparing from day one',
    subline: 'Science, history, GK, technology — age-appropriate topics for Grade 1-12. Daily 30-min prep + 15-min quiz. Build knowledge that lasts a lifetime.',
    highlight: 'Grade 1–12 · ₹1,500/year',
    highlightColor: 'bg-amber-100 text-amber-800',
    cta: 'See topics',
    ctaColor: 'bg-amber-600 hover:bg-amber-700',
  },
  {
    id: 'bundle',
    image: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&q=80&fit=crop',
    imageAlt: 'Happy child with parent learning together',
    badge: '✨ Best Value Bundle',
    badgeColor: 'bg-emerald-500',
    headline: 'Everything your child needs',
    subline: 'WhatsApp alerts + Multilingual + Speak + Story — all in one plan. The complete learning companion for pre-primary children.',
    highlight: 'Pre-Primary Complete · ₹2,500/year',
    highlightColor: 'bg-emerald-100 text-emerald-800',
    cta: 'View all plans',
    ctaColor: 'bg-emerald-600 hover:bg-emerald-700',
  },
];

const STORAGE_KEY = 'oakit_premium_popup_seen';

interface PremiumWelcomeModalProps {
  onClose: () => void;
}

export default function PremiumWelcomeModal({ onClose }: PremiumWelcomeModalProps) {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const current = SLIDES[slide];

  // Auto-advance every 5 seconds
  useEffect(() => {
    const t = setTimeout(() => {
      setSlide(s => (s + 1) % SLIDES.length);
      setImageLoaded(false);
    }, 5000);
    return () => clearTimeout(t);
  }, [slide]);

  function goTo(i: number) {
    setSlide(i);
    setImageLoaded(false);
  }

  function handleCta() {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    onClose();
    router.push('/parent/premium');
  }

  function handleClose() {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-0 sm:px-4">
      <div className="relative w-full sm:w-[420px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '92vh' }}>

        {/* Close */}
        <button onClick={handleClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition-colors">
          <X size={16} />
        </button>

        {/* Image */}
        <div className="relative h-52 sm:h-60 overflow-hidden bg-neutral-200">
          {/* Skeleton while loading */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-200 to-neutral-300 animate-pulse" />
          )}
          <img
            key={current.image}
            src={current.image}
            alt={current.imageAlt}
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-full object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* Badge on image */}
          <div className="absolute bottom-4 left-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${current.badgeColor} text-white text-xs font-bold shadow-lg`}>
              {current.badge}
            </span>
          </div>

          {/* Slide dots */}
          <div className="absolute bottom-4 right-4 flex gap-1.5">
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => goTo(i)}
                className={`rounded-full transition-all ${i === slide ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/50'}`} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-5 pt-5 pb-6">
          {/* Premium label */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-200">
              <Star size={11} className="text-amber-600 fill-amber-600" />
              <span className="text-[10px] font-bold text-amber-700">OAKIT PREMIUM</span>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${current.highlightColor}`}>
              {current.highlight}
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-xl font-black text-neutral-900 leading-tight mb-2"
            style={{ letterSpacing: '-0.03em' }}>
            {current.headline}
          </h2>

          {/* Subline */}
          <p className="text-sm text-neutral-500 leading-relaxed mb-5">
            {current.subline}
          </p>

          {/* Navigation arrows + CTA */}
          <div className="flex items-center gap-3">
            <button onClick={() => goTo((slide - 1 + SLIDES.length) % SLIDES.length)}
              className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-400 hover:bg-neutral-50 transition-colors shrink-0">
              <ChevronLeft size={18} />
            </button>

            <button onClick={handleCta}
              className={`flex-1 py-3 ${current.ctaColor} text-white font-bold rounded-2xl text-sm transition-colors flex items-center justify-center gap-2`}>
              {current.cta}
              <ChevronRight size={16} />
            </button>

            <button onClick={() => goTo((slide + 1) % SLIDES.length)}
              className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-400 hover:bg-neutral-50 transition-colors shrink-0">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Skip */}
          <button onClick={handleClose}
            className="w-full mt-3 text-xs text-neutral-400 hover:text-neutral-600 transition-colors py-1">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
