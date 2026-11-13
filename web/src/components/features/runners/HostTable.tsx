import type { CSSProperties, ReactNode } from 'react';

import {
  HOST_HEADINGS,
  NARROW_HEADINGS,
  narrowOf,
} from '@/components/features/runners/columns';
import { HostHead } from '@/components/features/runners/HostHead';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useColumnWidths } from '@/hooks/useColumnWidths';
import { columnTemplate, filled } from '@/lib/nested-table';

const END_FADE =
  '[mask-image:linear-gradient(to_right,black_calc(100%-min(2rem,var(--scroll-area-overflow-x-end,0px))),transparent)]';

type HostTableProps = {
  label?: string;
  children: ReactNode;
};

export function HostTable({ label, children }: HostTableProps) {
  const columns = useColumnWidths(HOST_HEADINGS.length);

  return (
    <ScrollArea
      orientation="both"
      className="min-h-0 flex-1"
      viewportClassName={END_FADE}
    >
      <section
        aria-label={label}
        style={
          {
            '--host-columns': columnTemplate(
              HOST_HEADINGS,
              columns.widths,
              false,
            ),
            '--host-columns-narrow': columnTemplate(
              NARROW_HEADINGS,
              narrowOf(columns.widths),
              false,
            ),
          } as CSSProperties
        }
        className="min-h-full px-1.5 pb-1.5 @5xl/pane:min-w-[68rem]"
      >
        <HostHead
          trailing={filled(HOST_HEADINGS, columns.widths, false)}
          onPin={columns.pin}
          onResize={columns.resize}
          onReset={columns.reset}
        />

        {children}
      </section>
    </ScrollArea>
  );
}
