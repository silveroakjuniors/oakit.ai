export default function CtaSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#1B4332] via-[#2d6a4f] to-[#40916c] px-8 py-16 sm:px-16 text-center">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />

          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Ready to transform your school?
            </h2>
            <p className="mt-4 text-lg text-white/70 max-w-xl mx-auto">
              Join schools across India that are using AI to plan better, teach smarter, and keep parents connected.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#pricing" className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-gray-50 text-[#1B4332] font-semibold rounded-full text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                Start 14-Day Free Trial
              </a>
              <a href="mailto:hello@oakit.ai" className="w-full sm:w-auto px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full text-sm border border-white/20 transition-all">
                Talk to Sales
              </a>
            </div>
            <p className="mt-6 text-xs text-white/50">
              No credit card required · Free onboarding support · Cancel anytime
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
