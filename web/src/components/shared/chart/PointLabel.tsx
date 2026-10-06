type PointLabelProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: unknown;
};

const GAP = 6;

export function PointLabel({ x, y, width, value }: PointLabelProps) {
  return (
    <text
      x={Number(x ?? 0) + Number(width ?? 0) / 2}
      y={Number(y ?? 0) - GAP}
      textAnchor="middle"
      fontSize={11}
      fill="var(--foreground)"
    >
      {String(value ?? '')}
    </text>
  );
}
