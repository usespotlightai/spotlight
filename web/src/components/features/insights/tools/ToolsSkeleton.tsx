import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

const MULTIPLES = 3;

export function ToolsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the tools"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
        <p className="font-medium text-foreground text-sm">Skills</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: MULTIPLES }, (_, at) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholder tiles have no identity
              key={at}
              className="flex flex-col gap-2 rounded-lg border border-border p-2.5"
            >
              <SkeletonLine className="w-24 text-xs" />
              <SkeletonLine className="h-12 w-full" />
              <SkeletonLine className="w-32 text-xs" />
            </div>
          ))}
        </div>
      </div>
      <InsightsCardSkeleton title="MCP servers" rows={3} />
    </div>
  );
}
