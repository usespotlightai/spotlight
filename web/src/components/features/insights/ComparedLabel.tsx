import { Noted } from '@/components/shared/Noted';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { ComparedRow } from '@/lib/tally-comparison';

export function ComparedLabel({ row }: { row: ComparedRow }) {
  const label = row.to ? (
    <TrailLink to={row.to} className="hover:text-foreground hover:underline">
      {row.label}
    </TrailLink>
  ) : (
    <span>{row.label}</span>
  );

  return row.note ? <Noted note={row.note}>{label}</Noted> : label;
}
