import type { CSSProperties, ReactNode } from 'react';
import { HOST_HEADINGS } from '@/components/features/runners/columns';
import { HostHead } from '@/components/features/runners/HostHead';
import { useColumnWidths } from '@/hooks/useColumnWidths';
import { columnTemplate, filled } from '@/lib/nested-table';

type HostTableProps = {
  label?: string;
  children: ReactNode;
};

export function HostTable({ label, children }: HostTableProps) {
  const columns = useColumnWidths(HOST_HEADINGS.length);

  return (
    <section
      aria-label={label}
      className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5"
      style={
        {
          '--host-columns': columnTemplate(
            HOST_HEADINGS,
            columns.widths,
            false,
          ),
        } as CSSProperties
      }
    >
      <HostHead
        trailing={filled(HOST_HEADINGS, columns.widths, false)}
        onPin={columns.pin}
        onResize={columns.resize}
        onReset={columns.reset}
      />

      {children}
    </section>
  );
}
