import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function BarRowSkeleton() {
  return (
    <li className="flex flex-col gap-0.5 text-xs">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1">
          <SkeletonLine className="w-24" />
        </span>
        <SkeletonLine className="w-10" />
        <SkeletonLine className="w-16" />
      </div>
      <span className="h-1 rounded-full bg-muted" />
    </li>
  );
}
