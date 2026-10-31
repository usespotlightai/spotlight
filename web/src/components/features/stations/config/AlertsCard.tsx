import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AlertSlide } from '@/components/features/stations/config/AlertSlide';
import { ConfigCard } from '@/components/features/stations/config/ConfigCard';
import { useSnapCarousel } from '@/hooks/useSnapCarousel';
import type { AlertRule } from '@/lib/station-monitoring';
import { cn } from '@/lib/utils';

const STEP =
  'flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40';

export function AlertsCard({ alerts }: { alerts: readonly AlertRule[] }) {
  const { track, at, pages, dragging, go, onScroll, dragHandlers } =
    useSnapCarousel(alerts.length);
  const paging = pages > 1;

  return (
    <ConfigCard
      title={`Alert rules · ${alerts.length}`}
      className="sm:col-span-2"
      action={
        paging && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Previous alert rule"
              disabled={at === 0}
              onClick={() => go(at - 1)}
              className={STEP}
            >
              <ChevronLeft aria-hidden className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Next alert rule"
              disabled={at === pages - 1}
              onClick={() => go(at + 1)}
              className={STEP}
            >
              <ChevronRight aria-hidden className="size-3.5" />
            </button>
          </div>
        )
      }
    >
      <ul
        ref={track}
        onScroll={onScroll}
        {...dragHandlers}
        aria-label="Alert rules"
        aria-roledescription="carousel"
        className={cn(
          '-mx-3 flex flex-1 gap-4 overflow-x-auto px-3 [scrollbar-width:none]',
          paging && 'cursor-grab',
          dragging && 'cursor-grabbing select-none',
        )}
      >
        {alerts.map((alert, place) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the alerts show in their written order and can repeat
          <AlertSlide key={place} alert={alert} />
        ))}
      </ul>

      {paging && (
        <div className="-mt-1 flex justify-center gap-1.5">
          {Array.from({ length: pages }, (_, place) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: the position of its page identifies a dot
              key={place}
              type="button"
              aria-label={`Show page ${place + 1} of ${pages}`}
              aria-current={place === at ? 'true' : undefined}
              onClick={() => go(place)}
              className={cn(
                'size-1.5 rounded-full transition-colors',
                place === at
                  ? 'bg-foreground'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/60',
              )}
            />
          ))}
        </div>
      )}
    </ConfigCard>
  );
}
