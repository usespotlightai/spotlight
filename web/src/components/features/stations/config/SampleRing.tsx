const RADIUS = 16;
const ROUND = 2 * Math.PI * RADIUS;

export function SampleRing({ share, label }: { share: number; label: string }) {
  const swept = Math.min(Math.max(share, 0), 1) * ROUND;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 40 40"
      className="size-20 shrink-0 -rotate-90"
    >
      <circle
        cx="20"
        cy="20"
        r={RADIUS}
        fill="none"
        strokeWidth="4"
        className="stroke-muted"
      />
      <circle
        cx="20"
        cy="20"
        r={RADIUS}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${swept} ${ROUND}`}
        className="stroke-chart-primary"
      />
    </svg>
  );
}
