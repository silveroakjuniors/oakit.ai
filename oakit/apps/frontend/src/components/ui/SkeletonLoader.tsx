interface SkeletonLoaderProps {
  variant?: 'text' | 'card' | 'stat' | 'row' | 'circle';
  count?: number;
  className?: string;
}

function SkeletonBase({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />;
}

export default function SkeletonLoader({ variant = 'text', count = 1, className = '' }: SkeletonLoaderProps) {
  const items = Array.from({ length: count });

  if (variant === 'stat') {
    return (
      <div className={`flex gap-3 ${className}`}>
        {items.map((_, i) => (
          <div key={i} className="flex-1 bg-white rounded-2xl border border-neutral-100 p-4">
            <SkeletonBase className="h-3 w-16 mb-3" />
            <SkeletonBase className="h-7 w-12 mb-1" />
            <SkeletonBase className="h-2.5 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        {items.map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-neutral-100 p-4">
            <div className="flex items-center gap-3 mb-3">
              <SkeletonBase className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <SkeletonBase className="h-3.5 w-32 mb-2" />
                <SkeletonBase className="h-2.5 w-20" />
              </div>
            </div>
            <SkeletonBase className="h-2.5 w-full mb-2" />
            <SkeletonBase className="h-2.5 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'row') {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {items.map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-neutral-100">
            <SkeletonBase className="w-9 h-9 rounded-full shrink-0" />
            <div className="flex-1">
              <SkeletonBase className="h-3 w-28 mb-1.5" />
              <SkeletonBase className="h-2.5 w-20" />
            </div>
            <SkeletonBase className="h-7 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'circle') {
    return (
      <div className={`flex gap-3 ${className}`}>
        {items.map((_, i) => (
          <SkeletonBase key={i} className="w-10 h-10 rounded-full" />
        ))}
      </div>
    );
  }

  // text (default)
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {items.map((_, i) => (
        <SkeletonBase key={i} className={`h-3 ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}
