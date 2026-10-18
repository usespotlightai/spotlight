import { useRef } from 'react';
import {
  HOST_COLUMNS,
  HOST_HEADINGS,
} from '@/components/features/runners/columns';
import { ColumnResizer } from '@/components/shared/ColumnResizer';
import { cn } from '@/lib/utils';

type HostHeadProps = {
  trailing: boolean;
  onPin: (widths: readonly number[]) => void;
  onResize: (column: number, width: number) => void;
  onReset: (column: number) => void;
};

export function HostHead({
  trailing,
  onPin,
  onResize,
  onReset,
}: HostHeadProps) {
  const row = useRef<HTMLDivElement>(null);
  const pin = () =>
    onPin(
      [...(row.current?.children ?? [])]
        .slice(0, HOST_HEADINGS.length)
        .map((cell) => cell.getBoundingClientRect().width),
    );

  return (
    <div
      ref={row}
      className={cn(
        'grid h-8 items-center gap-x-6 pr-3 pl-9 text-muted-foreground text-xs',
        HOST_COLUMNS,
      )}
    >
      {HOST_HEADINGS.map((heading, column) => (
        <span
          key={heading.label}
          className={cn('relative min-w-0', heading.numeric && 'text-right')}
        >
          <span className="block truncate">{heading.label}</span>
          {(column < HOST_HEADINGS.length - 1 || trailing) && (
            <ColumnResizer
              label={heading.label}
              onStart={pin}
              onResize={(width) => onResize(column, width)}
              onReset={() => onReset(column)}
            />
          )}
        </span>
      ))}
    </div>
  );
}
