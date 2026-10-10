import type { AlertTrigger } from '@/lib/station-watch';

const LINES: Record<AlertTrigger, string> = {
  rises: '0,22 14,20 26,21 38,14 50,9 64,3',
  falls: '0,3 14,6 26,5 38,12 50,17 64,22',
  above: '0,18 14,17 26,18 38,16 46,5 64,4',
  below: '0,7 14,8 26,7 38,9 46,20 64,21',
};

const THRESHOLD: Record<AlertTrigger, number> = {
  rises: 12,
  falls: 12,
  above: 11,
  below: 14,
};

export function AlertTrend({ trigger }: { trigger: AlertTrigger }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 25"
      preserveAspectRatio="none"
      className="h-7 w-full"
    >
      <line
        x1="0"
        x2="64"
        y1={THRESHOLD[trigger]}
        y2={THRESHOLD[trigger]}
        strokeWidth="1"
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
        className="stroke-foreground/45"
      />
      <polyline
        points={LINES[trigger]}
        fill="none"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className="stroke-chart-primary"
      />
    </svg>
  );
}
