import { Noted } from '@/components/shared/Noted';
import { formatPercent } from '@/lib/judge';
import type { RateInterval } from '@/lib/replay';

const SCALE = 'shrink-0 text-[0.6rem] text-faint tabular-nums';

const at = (share: number): string => `${(share * 100).toFixed(2)}%`;

type RateTrackProps = {
  rate: number | null;
  interval?: RateInterval | null;
  live: number | null;
  ink?: string;
};

export function RateTrack({
  rate,
  interval = null,
  live,
  ink = 'var(--chart-primary)',
}: RateTrackProps) {
  return (
    <div data-slot="rate-track" className="flex items-center gap-1.5">
      <span aria-hidden className={SCALE}>
        0%
      </span>

      <div className="relative h-4 min-w-0 flex-1">
        <span
          aria-hidden
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-chart-grid"
        />

        {rate !== null && interval && (
          <Noted
            note={`Likely range: ${formatPercent(interval.low)}–${formatPercent(interval.high)}`}
          >
            <span
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full opacity-35"
              style={{
                left: at(interval.low),
                width: at(interval.high - interval.low),
                background: ink,
              }}
            />
          </Noted>
        )}

        {live !== null && (
          <Noted note={`Live config: ${formatPercent(live)}`}>
            <span
              className="absolute inset-y-0 flex w-2 -translate-x-1/2 justify-center"
              style={{ left: at(live) }}
            >
              <span className="h-full w-[1.5px] rounded-full bg-chart-axis" />
            </span>
          </Noted>
        )}

        {rate !== null && (
          <Noted note={`Candidate: ${formatPercent(rate)}`}>
            <span
              className="absolute top-1/2 size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: at(rate), background: ink }}
            />
          </Noted>
        )}
      </div>

      <span aria-hidden className={SCALE}>
        100%
      </span>
    </div>
  );
}
