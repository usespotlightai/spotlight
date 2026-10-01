import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

type InsightsCardSkeletonProps = {
  title: string;
  rows?: number;
};

export function InsightsCardSkeleton({
  title,
  rows = 4,
}: InsightsCardSkeletonProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <p className="font-medium text-foreground text-sm">{title}</p>
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, at) => (
          <SkeletonLine
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
            key={at}
            className={at % 2 === 0 ? 'w-3/4 text-xs' : 'w-1/2 text-xs'}
          />
        ))}
      </div>
    </div>
  );
}
