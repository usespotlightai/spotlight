import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

type InsightsCardSkeletonProps = {
  title: string;
  rows: number;
};

export function InsightsCardSkeleton({
  title,
  rows,
}: InsightsCardSkeletonProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <p className="flex min-h-8 items-center border-border border-b bg-muted/40 px-2.5 py-1 font-medium text-foreground text-xs">
        {title}
      </p>
      <div className="flex flex-col gap-2 p-2.5">
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
