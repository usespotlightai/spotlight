import type { ReactElement, ReactNode } from 'react';

import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { nonEmpty } from '@/lib/non-empty';

type TileGroupProps = {
  title: string;
  tooltip?: string;
  children: ReactNode;
};

export function TileGroup({
  title,
  tooltip,
  children,
}: TileGroupProps): ReactElement {
  return (
    <section data-slot="tile-group" className="flex flex-col gap-3">
      <h3 className="flex min-h-7 items-center gap-1.5 font-medium text-foreground text-sm">
        {title}
        {nonEmpty(tooltip) && <InfoTooltip tooltip={tooltip} />}
      </h3>
      <InsightsTiles label={title}>{children}</InsightsTiles>
    </section>
  );
}
