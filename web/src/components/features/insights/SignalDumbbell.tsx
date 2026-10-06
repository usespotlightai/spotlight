import {
  type SignalReading,
  signalPlace,
  signalScale,
  signalTick,
} from '@/lib/insights';

const TRACK = 8;

const at = (reading: SignalReading, value: number): string =>
  `${(signalPlace(reading, value) * 100).toFixed(2)}%`;

export function SignalDumbbell({ reading }: { reading: SignalReading }) {
  const now = at(reading, reading.now);
  const before = reading.before === null ? null : at(reading, reading.before);
  const team = reading.team === null ? null : at(reading, reading.team);
  const flagged = at(reading, reading.flaggedAbove);

  return (
    <div
      aria-hidden
      className="flex items-center gap-2 text-[0.625rem] text-muted-foreground tabular-nums leading-4"
    >
      <span className="w-6 shrink-0 text-right">{signalTick(reading, 0)}</span>
      <svg
        aria-hidden
        height={TRACK * 2}
        className="block min-w-0 flex-1 overflow-visible"
      >
        <line
          x1="0"
          x2="100%"
          y1={TRACK}
          y2={TRACK}
          stroke="var(--chart-grid)"
          strokeWidth="1"
        />

        <line
          x1={flagged}
          x2={flagged}
          y1={TRACK - 8}
          y2={TRACK + 8}
          stroke="var(--destructive)"
          strokeWidth="1"
          strokeDasharray="2 2"
        />

        {team && (
          <line
            x1={team}
            x2={team}
            y1={TRACK - 6}
            y2={TRACK + 6}
            stroke="var(--chart-axis)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )}

        {before && (
          <>
            <line
              x1={before}
              x2={now}
              y1={TRACK}
              y2={TRACK}
              stroke="var(--destructive)"
              strokeOpacity="0.45"
              strokeWidth="2"
            />
            <circle
              cx={before}
              cy={TRACK}
              r="4"
              fill="var(--card)"
              stroke="var(--chart-axis)"
              strokeWidth="1.5"
            />
          </>
        )}

        <circle
          cx={now}
          cy={TRACK}
          r="5"
          fill="var(--destructive)"
          stroke="var(--card)"
          strokeWidth="2"
        />
      </svg>
      <span className="w-10 shrink-0">
        {signalTick(reading, signalScale(reading))}
      </span>
    </div>
  );
}
