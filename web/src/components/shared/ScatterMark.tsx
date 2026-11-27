export type MarkShape = 'circle' | 'diamond' | 'square';

const SIZE = 4;

type ScatterMarkProps = {
  cx?: number;
  cy?: number;
  fill?: string;
  shape: MarkShape;
  hollow?: boolean;
};

export function ScatterMark({
  cx,
  cy,
  fill,
  shape,
  hollow = false,
}: ScatterMarkProps) {
  if (cx === undefined || cy === undefined) {
    return null;
  }

  const ink = hollow
    ? { fill: 'var(--card)', stroke: fill, strokeWidth: 1.5 }
    : { fill };

  if (shape === 'circle') {
    return <circle cx={cx} cy={cy} r={SIZE} {...ink} />;
  }

  return (
    <rect
      x={cx - SIZE}
      y={cy - SIZE}
      width={SIZE * 2}
      height={SIZE * 2}
      transform={shape === 'diamond' ? `rotate(45 ${cx} ${cy})` : undefined}
      {...ink}
    />
  );
}
