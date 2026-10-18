import type { ReactNode } from 'react';
import { InfoTooltip } from '@/components/features/insights/InfoTooltip';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';

type TileGroupProps = {
  title: string;
  tooltip?: string;
  children: ReactNode;
};

export function TileGroup({ title, tooltip, children }: TileGroupProps) {
  return (
    <section data-slot="tile-group" className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-1.5 font-medium text-foreground text-xs">
        {title}
        {tooltip && <InfoTooltip tooltip={tooltip} />}
      </h3>
      <InsightsTiles label={title}>{children}</InsightsTiles>
    </section>
  );
}
