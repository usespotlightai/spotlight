import { ceilingShare, type Spend } from '@/lib/replay';

type CeilingBarProps = {
  spent: Spend;
  ceiling: Spend;
};

export function CeilingBar({ spent, ceiling }: CeilingBarProps) {
  const share = ceilingShare(spent, ceiling);

  return (
    <span
      aria-hidden
      data-slot="ceiling-bar"
      className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
    >
      <span
        className={
          share >= 1
            ? 'block h-full bg-destructive'
            : 'block h-full bg-foreground/60'
        }
        style={{ width: `${share * 100}%` }}
      />
    </span>
  );
}
