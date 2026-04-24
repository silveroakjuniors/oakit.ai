'use client';

import React, { useState, useEffect } from 'react';

interface OakitLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light';
  showTagline?: boolean;
  className?: string;
}

const sizeMap = { xs: 'text-lg', sm: 'text-2xl', md: 'text-4xl', lg: 'text-6xl' };
const taglineSizeMap = { xs: 'text-[9px]', sm: 'text-[11px]', md: 'text-[13px]', lg: 'text-lg' };
const iconSizeMap = { xs: 'w-5 h-5', sm: 'w-7 h-7', md: 'w-10 h-10', lg: 'w-14 h-14' };

export default function OakitLogo({
  size = 'md', variant = 'dark', showTagline = false, className = ''
}: OakitLogoProps) {
  const [tagline, setTagline] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('oakit_tagline') || '';
    setTagline(saved);
  }, []);

  const textColor = variant === 'dark' ? 'text-green-900' : 'text-white';
  const subColor  = variant === 'dark' ? 'text-green-600/70' : 'text-white/60';
  const dotColor  = '#E8960C';

  return (
    <div className={`flex items-center gap-3 ${className} animate-in fade-in duration-500`}>
      <div className={`${iconSizeMap[size]} relative flex items-center justify-center rounded-xl overflow-hidden`}>
        <div className="absolute inset-0 bg-green-600 rotate-45 scale-75 rounded-lg" />
        <div className="relative z-10 font-black text-white text-[50%] flex items-center justify-center">
          <span className="mb-0.5">O</span>
          <div className="w-1 h-1 rounded-full ml-0.5" style={{ backgroundColor: dotColor }} />
        </div>
        {variant === 'light' && <div className="absolute inset-0 bg-green-300/30 blur-lg -z-10" />}
      </div>
      <div className="flex flex-col justify-center">
        <h1 className={`font-black tracking-tighter leading-none ${sizeMap[size]} ${textColor}`}>
          Oakit<span style={{ color: dotColor }}>.ai</span>
        </h1>
        {showTagline && tagline && (
          <p className={`${taglineSizeMap[size]} font-bold uppercase tracking-[0.15em] mt-1 ${subColor}`}>
            {tagline}
          </p>
        )}
      </div>
    </div>
  );
}