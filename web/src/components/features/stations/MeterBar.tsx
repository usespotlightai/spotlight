const placed = (value: number): string =>
  `${Math.min(Math.max(value, 0), 1) * 100}%`;

type MeterBarProps = {
  share: number;
  label?: string;
  mark?: number;
  markTitle?: string;
};

export function MeterBar({ share, label, mark, markTitle }: MeterBarProps) {
  const described = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true };

  return (
    <span {...described} className="relative block h-1.5 rounded-full bg-muted">
      <span
        className="absolute inset-y-0 left-0 rounded-full bg-chart-primary"
        style={{ width: placed(share) }}
      />
      {mark !== undefined && (
        <span
          aria-hidden
          title={markTitle}
          className="absolute -inset-y-1 w-px bg-foreground/40"
          style={{ left: placed(mark) }}
        />
      )}
    </span>
  );
}
