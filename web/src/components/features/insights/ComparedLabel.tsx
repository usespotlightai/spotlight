import { WithTooltip } from '@/components/shared/WithTooltip';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { nonEmpty } from '@/lib/non-empty';
import type { ComparedRow } from '@/lib/tally-comparison';

export function ComparedLabel({ row }: { row: ComparedRow }) {
  const label = nonEmpty(row.to) ? (
    <TrailLink to={row.to} className="hover:text-foreground hover:underline">
      {row.label}
    </TrailLink>
  ) : (
    <span>{row.label}</span>
  );

  return nonEmpty(row.tooltip) ? (
    <WithTooltip tooltip={row.tooltip}>{label}</WithTooltip>
  ) : (
    label
  );
}
