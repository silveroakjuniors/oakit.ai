export default function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#f0fdf4]/40 via-white to-white" />
      <div className="absolute inset-0 bg-grid opacity-60" />

      {/* Decorative blobs */}
      <div className="absolute top-20 right-0 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-emerald-100/40 to-teal-50/20 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-amber-50/30 to-yellow-50/20 blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 mb-8 fade-up">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-700 tracking-wide uppercase">AI-Powered School Platform</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-[#1a1a2e] fade-up-delay-1">
            The smartest way to run
            <br />
            <span className="text-gradient">your school</span>
          </h1>

          {/* Subheadline */}
          <p className="mt-6 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed fade-up-delay-2">
            Curriculum planning, daily operations, parent engagement, and AI-powered insights — all in one beautiful platform built for preschools and primary schools.
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 fade-up-delay-3">
            <a href="#pricing" className="w-full sm:w-auto px-8 py-3.5 bg-[#1B4332] hover:bg-[#2d6a4f] text-white font-semibold rounded-full text-sm transition-all shadow-lg shadow-emerald-900/20 hover:shadow-xl hover:shadow-emerald-900/25 hover:-translate-y-0.5">
              Start 14-Day Free Trial
            </a>
            <a href="#how-it-works" className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-gray-50 text-[#1B4332] font-semibold rounded-full text-sm border border-gray-200 hover:border-gray-300 transition-all">
              See How It Works
            </a>
          </div>

          {/* Trust line */}
          <p className="mt-8 text-xs text-gray-400 fade-up-delay-4">
            No credit card required · Setup in 5 minutes · Cancel anytime
          </p>
        </div>

        {/* Hero visual — App preview placeholder */}
        <div className="mt-16 max-w-5xl mx-auto fade-up-delay-4">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-gray-900/10 border border-gray-200/60">
            {/* Browser chrome */}
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-300" />
                <div className="w-3 h-3 rounded-full bg-amber-300" />
                <div className="w-3 h-3 rounded-full bg-emerald-300" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 bg-white rounded-md border border-gray-200 text-xs text-gray-400 font-mono">
                  oakit.silveroakjuniors.in
                </div>
              </div>
            </div>
            {/* App screenshot placeholder */}
            <div className="bg-gradient-to-br from-[#f0fdf4] to-[#ecfdf5] aspect-[16/9] flex items-center justify-center">
              <div className="text-center px-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#1B4332] flex items-center justify-center">
                  <span className="text-2xl text-white font-bold">O</span>
                </div>
                <p className="text-lg font-semibold text-[#1B4332]">Your school dashboard</p>
                <p className="text-sm text-gray-500 mt-2">Video demo coming soon — see the full platform in action</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
