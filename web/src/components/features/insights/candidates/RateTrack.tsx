import type { RateInterval } from '@/lib/replay';

const MID = 8;

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
    <svg
      aria-hidden
      data-slot="rate-track"
      width="100%"
      height={MID * 2}
      className="block overflow-visible"
    >
      <line
        x1="0"
        x2="100%"
        y1={MID}
        y2={MID}
        stroke="var(--chart-grid)"
        strokeWidth="1"
      />
      {rate !== null && interval && (
        <line
          x1={at(interval.low)}
          x2={at(interval.high)}
          y1={MID}
          y2={MID}
          stroke={ink}
          strokeOpacity="0.35"
          strokeWidth="4"
          strokeLinecap="round"
        />
      )}
      {live !== null && (
        <line
          x1={at(live)}
          x2={at(live)}
          y1={MID - 6}
          y2={MID + 6}
          stroke="var(--chart-axis)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
      {rate !== null && <circle cx={at(rate)} cy={MID} r="4.5" fill={ink} />}
    </svg>
  );
}
