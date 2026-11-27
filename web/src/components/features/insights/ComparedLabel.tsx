import type { ReactElement } from 'react';

import { WithTooltip } from '@/components/shared/WithTooltip';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { ComparedRow } from '@/lib/tally-comparison';

export function ComparedLabel({ row }: { row: ComparedRow }): ReactElement {
  const label =
    row.to !== undefined && row.to !== '' ? (
      <TrailLink to={row.to} className="hover:text-foreground hover:underline">
        {row.label}
      </TrailLink>
    ) : (
      <span>{row.label}</span>
    );

  return row.tooltip !== undefined && row.tooltip !== '' ? (
    <WithTooltip tooltip={row.tooltip}>{label}</WithTooltip>
  ) : (
    label
  );
}
