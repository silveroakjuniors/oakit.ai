interface SkeletonProps {
  className?: string;
  lines?: number;
  avatar?: boolean;
}

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`bg-neutral-200 rounded-lg animate-shimmer bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 bg-[length:200%_100%] ${className}`} />;
}

export function Skeleton({ className = '', lines = 1, avatar = false }: SkeletonProps) {
  if (lines > 1 || avatar) {
    return (
      <div className={`flex gap-3 ${className}`}>
        {avatar && <div className="w-10 h-10 rounded-full bg-neutral-200 animate-shimmer bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 bg-[length:200%_100%] shrink-0" />}
        <div className="flex-1 flex flex-col gap-2">
          {Array.from({ length: lines }).map((_, i) => (
            <SkeletonLine key={i} className={`h-3 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} />
          ))}
        </div>
      </div>
    );
  }
  return <SkeletonLine className={`h-4 w-full ${className}`} />;
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-neutral-200/80 p-5 ${className}`}>
      <Skeleton lines={3} avatar />
    </div>
  );
}

export default Skeleton;
