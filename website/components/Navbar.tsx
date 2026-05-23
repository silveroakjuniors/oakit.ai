'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-gray-100/60">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1B4332] to-[#40916c] flex items-center justify-center">
            <span className="text-white font-bold text-sm">O</span>
          </div>
          <span className="text-lg font-bold text-[#1B4332] tracking-tight">oakit.ai</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-gray-600 hover:text-[#1B4332] transition-colors font-medium">Features</a>
          <a href="#how-it-works" className="text-sm text-gray-600 hover:text-[#1B4332] transition-colors font-medium">How it Works</a>
          <a href="#pricing" className="text-sm text-gray-600 hover:text-[#1B4332] transition-colors font-medium">Pricing</a>
          <a href="#faq" className="text-sm text-gray-600 hover:text-[#1B4332] transition-colors font-medium">FAQ</a>
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a href="https://oakit.silveroakjuniors.in/login" className="text-sm font-medium text-[#1B4332] hover:text-[#40916c] transition-colors px-4 py-2">
            Sign In
          </a>
          <a href="#pricing" className="text-sm font-semibold text-white bg-[#1B4332] hover:bg-[#2d6a4f] px-5 py-2.5 rounded-full transition-all shadow-sm hover:shadow-md">
            Get Started Free
          </a>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5">
          <span className={`w-5 h-0.5 bg-gray-700 transition-all ${mobileOpen ? 'rotate-45 translate-y-1' : ''}`} />
          <span className={`w-5 h-0.5 bg-gray-700 transition-all ${mobileOpen ? 'opacity-0' : ''}`} />
          <span className={`w-5 h-0.5 bg-gray-700 transition-all ${mobileOpen ? '-rotate-45 -translate-y-1' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3">
          <a href="#features" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 py-2">Features</a>
          <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 py-2">How it Works</a>
          <a href="#pricing" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 py-2">Pricing</a>
          <a href="#faq" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 py-2">FAQ</a>
          <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
            <a href="https://oakit.silveroakjuniors.in/login" className="text-sm font-medium text-[#1B4332] py-2">Sign In</a>
            <a href="#pricing" className="text-sm font-semibold text-white bg-[#1B4332] px-5 py-2.5 rounded-full text-center">Get Started Free</a>
          </div>
        </div>
      )}
    </nav>
  );
}
