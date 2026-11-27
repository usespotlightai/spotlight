type AlertLegendMarkProps = {
  label: string;
  stroke: string;
  dash?: string;
  opacity?: number;
};

export function AlertLegendMark({
  label,
  stroke,
  dash,
  opacity,
}: AlertLegendMarkProps) {
  return (
    <li className="flex items-center gap-1.5">
      <svg aria-hidden width="16" height="2" className="shrink-0">
        <line
          x1="0"
          y1="1"
          x2="16"
          y2="1"
          stroke={stroke}
          strokeWidth="1.5"
          strokeDasharray={dash}
          strokeOpacity={opacity}
        />
      </svg>
      {label}
    </li>
  );
}
