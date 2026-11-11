import type { ReactNode } from 'react';

import { WithTooltip } from '@/components/shared/WithTooltip';
import type { TooltipText } from '@/lib/tooltip-note';

type StackedSegment = {
  readonly key: string;
  readonly value: number;
  readonly color: string;
};

export type StackedRow = {
  readonly key: string;
  readonly label: string;
  readonly segments: readonly StackedSegment[];
  readonly length: number;
  readonly figure: ReactNode;
  readonly tooltip: TooltipText;
};

type StackedRowsProps = {
  label: string;
  rows: readonly StackedRow[];
};

export function StackedRows({ label, rows }: StackedRowsProps) {
  return (
    <ul aria-label={label} data-slot="stacked-rows" className="flex flex-col">
      {rows.map((row) => (
        <li key={row.key}>
          <WithTooltip tooltip={row.tooltip}>
            <div className="grid h-7 cursor-default grid-cols-[4.5rem_minmax(0,1fr)_5.5rem] items-center gap-3 rounded-sm text-sm">
              <span className="truncate text-muted-foreground text-xs">
                {row.label}
              </span>
              <span className="flex h-3 min-w-0 items-stretch">
                <span
                  className="flex min-w-0 gap-px overflow-hidden rounded-[2px]"
                  style={{ width: `${Math.max(row.length, 0) * 100}%` }}
                >
                  {row.segments
                    .filter((segment) => segment.value > 0)
                    .map((segment) => (
                      <span
                        key={segment.key}
                        className="h-full min-w-px"
                        style={{
                          flexGrow: segment.value,
                          background: segment.color,
                        }}
                      />
                    ))}
                </span>
              </span>
              <span className="text-right tabular-nums">{row.figure}</span>
            </div>
          </WithTooltip>
        </li>
      ))}
    </ul>
  );
}
