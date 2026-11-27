const SIZE = 14;
const RADIUS = 5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type ContextDonutProps = {
  used: number;
  size: number;
};

export function ContextDonut({ used, size }: ContextDonutProps) {
  const share = size > 0 ? Math.min(used / size, 1) : 0;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      fill="none"
      aria-hidden
      className="size-3.5 shrink-0 -rotate-90"
    >
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        stroke="currentColor"
        strokeWidth="2.5"
        className="text-border"
      />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={`${share * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        className={share > 0.85 ? 'text-destructive' : 'text-muted-foreground'}
      />
    </svg>
  );
}
