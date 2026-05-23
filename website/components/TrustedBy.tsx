export default function TrustedBy() {
  return (
    <section className="py-12 border-y border-gray-100 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">
          Trusted by schools across India
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 opacity-60">
          {['Silveroak Juniors', 'Little Scholars', 'Bright Minds Academy', 'Green Valley School', 'Sunshine Preschool'].map(name => (
            <div key={name} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                <span className="text-xs font-bold text-gray-500">{name[0]}</span>
              </div>
              <span className="text-sm font-medium text-gray-500">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
