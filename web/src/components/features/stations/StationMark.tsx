import { StationIcon } from '@/components/features/board/column/StationIcon';

type StationMarkProps = {
  share: number;
  color?: string;
};

export function StationMark({ share, color }: StationMarkProps) {
  const tint = color ?? 'var(--muted-foreground)';

  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center rounded-lg"
      style={{
        backgroundColor: `color-mix(in oklab, ${tint} 12%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${tint} 22%, transparent)`,
      }}
    >
      <StationIcon share={share} color={color} className="size-5" />
    </span>
  );
}
