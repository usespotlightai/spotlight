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
    <SkeletonBlock className="max-sm:odd:last:col-span-2">
      <div
        data-slot="insights-tile"
        className="flex min-h-[7.625rem] min-w-0 flex-col gap-1 overflow-hidden rounded-lg border border-border px-4 py-3"
      >
        <dt className="flex min-h-5 items-center gap-1.5 text-muted-foreground text-sm leading-5">
          {label === null ? (
            <SkeletonLine className="w-20" />
          ) : (
            <span className="line-clamp-1">{label}</span>
          )}
          {tooltip && <InfoTooltip tooltip={tooltip} />}
        </dt>
        <dd className="flex flex-1 flex-col">
          <span className="flex flex-col items-start gap-0.5">
            <SkeletonLine
              className={cn(wide ? 'w-20' : 'w-12', 'text-xl leading-7')}
            />
            {delta && <SkeletonLine className="w-12 text-sm leading-5" />}
            {typeof detail === 'string' ? (
              <span className="text-muted-foreground text-sm leading-5">
                {detail}
              </span>
            ) : (
              detail && <SkeletonLine className="w-20 text-sm leading-5" />
            )}
          </span>
          {trend && (
            <span className="mt-auto pt-2">
              <Skeleton className="h-6 w-full" />
            </span>
          )}
        </dd>
      </div>
    </SkeletonBlock>
  );
}
