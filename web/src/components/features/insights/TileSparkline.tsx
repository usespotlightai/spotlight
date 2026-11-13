const TONES = {
  primary: 'var(--chart-primary)',
  muted: 'var(--muted-foreground)',
  done: 'var(--outcome-done)',
} as const;

const WIDTH = 100;

const HEIGHT = 24;

const TOP = 2;

type Point = { x: number; y: number };

const runsOf = (values: readonly (number | null)[]): Point[][] => {
  const max = Math.max(0, ...values.map((value) => value ?? 0));
  const step = WIDTH / Math.max(values.length - 1, 1);
  const runs: Point[][] = [];
  let run: Point[] = [];

  values.forEach((value, at) => {
    if (value === null) {
      run = [];
      return;
    }
    if (run.length === 0) {
      runs.push(run);
    }
    run.push({
      x: at * step,
      y: max > 0 ? HEIGHT - (value / max) * (HEIGHT - TOP) : HEIGHT,
    });
  });

  return runs.filter((each) => each.length > 1);
};

const lineOf = (run: readonly Point[]): string =>
  run.map(({ x, y }, at) => `${at === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');

const areaOf = (run: readonly Point[]): string =>
  `${lineOf(run)} L${run.at(-1)?.x} ${HEIGHT} L${run[0]?.x} ${HEIGHT} Z`;

type TileSparklineProps = {
  label: string;
  values: readonly (number | null)[];
  tone?: keyof typeof TONES;
};

export function TileSparkline({
  label,
  values,
  tone = 'primary',
}: TileSparklineProps) {
  const ink = TONES[tone];

  return (
    <svg
      role="img"
      aria-label={label}
      data-slot="tile-sparkline"
      className="block h-6 w-full"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
    >
      {runsOf(values).map((run) => (
        <g key={run[0]?.x}>
          <path d={areaOf(run)} fill={ink} fillOpacity={0.08} />
          <path
            d={lineOf(run)}
            fill="none"
            stroke={ink}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </g>
      ))}
    </svg>
  );
}
