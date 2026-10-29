import { EmptyDetail } from '@/components/features/insights/EmptyDetail';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonBlock } from '@/components/shared/skeleton/SkeletonBlock';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import type { TileBones } from '@/lib/insights-tiles';
import { cn } from '@/lib/utils';

export function InsightsTileSkeleton({
  label,
  tooltip,
  wide,
  delta,
  detail,
  trend,
}: TileBones) {
  return (
    <SkeletonBlock>
      <div
        data-slot="insights-tile"
        className="flex min-h-30 min-w-0 flex-col gap-1.5 overflow-hidden group-data-top-aligned/tiles:gap-8.5 group-data-stacked/tiles:gap-2 rounded-lg border border-border bg-card p-3"
      >
        <dt className="flex min-h-4 items-center gap-1.5 text-foreground text-xs leading-4">
          {label === null ? (
            <SkeletonLine className="w-20" />
          ) : (
            <span className="truncate">{label}</span>
          )}
          {tooltip && <InfoTooltip tooltip={tooltip} />}
        </dt>
        <dd
          className={cn(
            'flex flex-1 flex-col gap-1.5',
            !trend &&
              'justify-center group-data-top-aligned/tiles:justify-start group-data-stacked/tiles:justify-start',
          )}
        >
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <SkeletonLine
              className={cn(
                wide ? 'w-20' : 'w-12',
                'text-[1.375rem] leading-none',
              )}
            />
            {delta && <SkeletonLine className="w-12 text-xs" />}
          </span>
          {typeof detail === 'string' ? (
            <span className="text-muted-foreground text-xs">{detail}</span>
          ) : detail ? (
            <SkeletonLine className="w-20 text-xs" />
          ) : (
            !trend && <EmptyDetail />
          )}
          {trend && (
            <span className="mt-auto pt-2">
              <Skeleton className="h-8 w-full" />
            </span>
          )}
        </dd>
      </div>
    </SkeletonBlock>
  );
}
