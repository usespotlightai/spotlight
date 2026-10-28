import type { CSSProperties, ReactNode } from 'react';
import { HOST_HEADINGS } from '@/components/features/runners/columns';
import { HostHead } from '@/components/features/runners/HostHead';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useColumnWidths } from '@/hooks/useColumnWidths';
import { columnTemplate, filled } from '@/lib/nested-table';

type HostTableProps = {
  label?: string;
  children: ReactNode;
};

export function HostTable({ label, children }: HostTableProps) {
  const columns = useColumnWidths(HOST_HEADINGS.length);

  return (
    <ScrollArea className="min-h-0 flex-1">
      <section
        aria-label={label}
        style={
          {
            '--host-columns': columnTemplate(
              HOST_HEADINGS,
              columns.widths,
              false,
            ),
          } as CSSProperties
        }
        className="min-h-full px-1.5 pb-1.5"
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
