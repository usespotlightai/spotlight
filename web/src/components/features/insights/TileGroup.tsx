import type { ReactNode } from 'react';
import { InfoNote } from '@/components/features/insights/InfoNote';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';

type TileGroupProps = {
  title: string;
  note?: string;
  children: ReactNode;
};

export function TileGroup({ title, note, children }: TileGroupProps) {
  return (
    <section data-slot="tile-group" className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-1.5 font-medium text-foreground text-xs">
        {title}
        {note && <InfoNote note={note} />}
      </h3>
      <InsightsTiles label={title}>{children}</InsightsTiles>
    </section>
  );
}
