import { usePlotArea, useXAxisScale, useYAxisScale } from 'recharts';

import { LABEL_SIZE, placeLabels } from '@/lib/point-labels';

export type ChartLabel = {
  readonly key: string;
  readonly text: string;
  readonly cost: number;
  readonly value: number;
};

export function PointLabels({ labels }: { labels: readonly ChartLabel[] }) {
  const across = useXAxisScale();
  const up = useYAxisScale();
  const plot = usePlotArea();

  if (!across || !up) {
    return null;
  }

  const placed = placeLabels(
    labels.flatMap((label) => {
      const x = across(label.cost);
      const y = up(label.value);

      return x === undefined || y === undefined
        ? []
        : [{ key: label.key, text: label.text, x, y }];
    }),
    plot
      ? {
          left: plot.x,
          right: plot.x + plot.width,
          top: plot.y,
          bottom: plot.y + plot.height,
        }
      : undefined,
  );

  return (
    <g pointerEvents="none">
      {placed.map((label) => (
        <text
          key={label.key}
          x={label.x}
          y={label.y}
          textAnchor={label.anchor}
          fontSize={LABEL_SIZE}
          fill="var(--foreground)"
        >
          {label.text}
        </text>
      ))}
    </g>
  );
}
