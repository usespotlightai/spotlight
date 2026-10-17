import type { ReactNode } from 'react';
import { GlanceTile } from '@/components/features/stations/overview/GlanceTile';
import { SectionLinkSkeleton } from '@/components/shared/skeleton/SectionLinkSkeleton';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonBlock } from '@/components/shared/skeleton/SkeletonBlock';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import {
  GLANCE_COLUMNS,
  GLANCE_TITLE,
  type GlanceVisual,
} from '@/lib/station-outcomes';

const STRIP = 8;

const VISUALS: Record<GlanceVisual, ReactNode> = {
  strip: (
    <span className="flex flex-wrap gap-1.5">
      {Array.from({ length: STRIP }, (_, at) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder runs have no identity
        <Skeleton key={at} className="size-3.5 rounded-[3px]" />
      ))}
    </span>
  ),
  share: <Skeleton className="h-1.5 rounded-full" />,
  cost: <Skeleton className="h-8" />,
  duration: <Skeleton className="h-8" />,
};

export function GlanceSkeleton() {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium text-foreground text-xs">{GLANCE_TITLE}</h2>
        <SectionLinkSkeleton>See in Insights</SectionLinkSkeleton>
      </div>
      <dl
        aria-label={GLANCE_TITLE}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        {GLANCE_COLUMNS.map((column) => (
          <SkeletonBlock key={column.label}>
            <GlanceTile
              label={column.label}
              value={<SkeletonLine className="w-16" />}
              detail={
                column.counted ? <SkeletonLine className="w-14" /> : undefined
              }
            >
              {VISUALS[column.visual]}
            </GlanceTile>
          </SkeletonBlock>
        ))}
      </dl>
    </section>
  );
}
