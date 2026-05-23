export default function TestimonialsSection() {
  const testimonials = [
    {
      quote: "Oakit has transformed how we manage our curriculum. Teachers spend less time planning and more time teaching. The AI suggestions are remarkably accurate.",
      name: "Dr. Meera Pillai",
      role: "Principal, Silveroak Juniors",
      avatar: "M",
    },
    {
      quote: "As a parent, I love getting daily updates about my child. The journey notes make me feel connected to what happens in class every single day.",
      name: "Priya Sharma",
      role: "Parent, LKG",
      avatar: "P",
    },
    {
      quote: "The attendance and plan completion tracking keeps our teachers accountable. I can see at a glance which sections need attention.",
      name: "Rajesh Kumar",
      role: "Franchise Director",
      avatar: "R",
    },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-sm font-semibold text-[#1B4332] uppercase tracking-widest mb-3">What schools say</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1a1a2e] tracking-tight">
            Loved by schools, teachers, and parents
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <div key={i} className="card-hover p-6 rounded-2xl border border-gray-100 bg-white">
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, j) => (
                  <svg key={j} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-6">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1B4332] to-[#40916c] flex items-center justify-center text-white text-sm font-bold">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1a1a2e]">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
