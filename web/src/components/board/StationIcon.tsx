import { cn } from '@/lib/utils';

const CENTRE = 8;
const WEDGE = 3.5;

const wedgePath = (share: number): string => {
  const angle = 2 * Math.PI * share;
  const x = (CENTRE + WEDGE * Math.sin(angle)).toFixed(3);
  const y = (CENTRE - WEDGE * Math.cos(angle)).toFixed(3);
  const sweptWide = share > 0.5 ? 1 : 0;

  return `M ${CENTRE} ${CENTRE} L ${CENTRE} ${CENTRE - WEDGE} A ${WEDGE} ${WEDGE} 0 ${sweptWide} 1 ${x} ${y} Z`;
};

type StationIconProps = {
  share: number;
  color?: string;
  className?: string;
};

export function StationIcon({ share, color, className }: StationIconProps) {
  const filled = Math.min(Math.max(share, 0), 1);
  const ink = color ?? 'currentColor';

  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      data-slot="station-icon"
      className={cn('size-4 shrink-0', className)}
    >
      <circle cx={CENTRE} cy={CENTRE} r="6" stroke={ink} strokeWidth="1.5" />

      {filled >= 1 ? (
        <circle cx={CENTRE} cy={CENTRE} r={WEDGE} fill={ink} />
      ) : (
        filled > 0 && <path d={wedgePath(filled)} fill={ink} />
      )}
    </svg>
  );
}
