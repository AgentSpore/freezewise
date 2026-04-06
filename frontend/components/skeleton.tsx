import { cn } from "@/lib/utils";

export function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-4 animate-pulse bg-neutral-100",
        className,
      )}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="border-b border-neutral-100 py-5">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 animate-pulse bg-neutral-100" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="w-3/4" />
          <SkeletonLine className="w-1/2" />
          <div className="mt-3 flex gap-6">
            <SkeletonLine className="w-16" />
            <SkeletonLine className="w-16" />
            <SkeletonLine className="w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonRecipe() {
  return (
    <div className="border-b border-neutral-100 py-6 space-y-3">
      <SkeletonLine className="w-2/3 h-5" />
      <SkeletonLine className="w-1/3" />
      <div className="space-y-1.5 mt-3">
        <SkeletonLine className="w-full" />
        <SkeletonLine className="w-5/6" />
        <SkeletonLine className="w-4/6" />
      </div>
    </div>
  );
}
