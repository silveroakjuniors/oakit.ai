export default function PricingSection() {
  const plans = [
    {
      name: 'Starter',
      price: '2,999',
      period: '/month',
      description: 'Perfect for single-branch preschools getting started',
      features: [
        'Up to 100 students',
        'AI curriculum planning',
        'Teacher & parent portals',
        'Attendance & daily plans',
        'Child journey notes',
        'Basic reports',
        '500 AI credits/month',
        'Email support',
      ],
      cta: 'Start Free Trial',
      popular: false,
      gradient: '',
    },
    {
      name: 'Professional',
      price: '5,999',
      period: '/month',
      description: 'For growing schools that want the full experience',
      features: [
        'Up to 300 students',
        'Everything in Starter',
        'Financial module (fees, salary)',
        'Principal dashboard & analytics',
        'Smart alerts & insights',
        'HR management',
        'Parent messaging',
        '2,000 AI credits/month',
        'Priority support',
      ],
      cta: 'Start Free Trial',
      popular: true,
      gradient: 'from-[#1B4332] to-[#2d6a4f]',
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For franchises and multi-branch school groups',
      features: [
        'Unlimited students',
        'Everything in Professional',
        'Multi-school franchise portal',
        'Centralized curriculum management',
        'Cross-school analytics',
        'Custom branding',
        'Unlimited AI credits',
        'Dedicated account manager',
        'SLA & onboarding support',
      ],
      cta: 'Contact Sales',
      popular: false,
      gradient: '',
    },
  ];

  return (
    <section id="pricing" className="py-24 bg-gray-50/50 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-sm font-semibold text-[#1B4332] uppercase tracking-widest mb-3">Simple pricing</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1a1a2e] tracking-tight">
            Plans that grow with your school
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Start free for 14 days. No credit card required. Upgrade when you are ready.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <div key={i} className={`relative rounded-2xl border ${plan.popular ? 'border-[#1B4332] shadow-xl shadow-emerald-900/10' : 'border-gray-200'} bg-white overflow-hidden card-hover`}>
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 bg-[#1B4332] text-white text-center text-xs font-semibold py-1.5 uppercase tracking-wider">
                  Most Popular
                </div>
              )}
              <div className={`px-6 pt-${plan.popular ? '10' : '6'} pb-6`}>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{plan.name}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  {plan.price !== 'Custom' && <span className="text-sm text-gray-400">₹</span>}
                  <span className="text-4xl font-extrabold text-[#1a1a2e]">{plan.price}</span>
                  {plan.period && <span className="text-sm text-gray-400">{plan.period}</span>}
                </div>
                <p className="mt-2 text-sm text-gray-500">{plan.description}</p>

                <button className={`mt-6 w-full py-3 rounded-full text-sm font-semibold transition-all ${
                  plan.popular
                    ? 'bg-[#1B4332] hover:bg-[#2d6a4f] text-white shadow-lg shadow-emerald-900/20'
                    : 'bg-gray-100 hover:bg-gray-200 text-[#1a1a2e]'
                }`}>
                  {plan.cta}
                </button>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-sm text-gray-600">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
