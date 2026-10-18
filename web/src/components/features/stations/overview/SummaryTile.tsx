import type { ReactNode } from 'react';

type SummaryTileProps = {
  label: string;
  value: string;
  detail?: string;
  children?: ReactNode;
};

export function SummaryTile({
  label,
  value,
  detail,
  children,
}: SummaryTileProps) {
  return (
    <div
      data-slot="summary-tile"
      className="flex min-h-36 min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-4"
    >
      <dt className="text-foreground text-xs">{label}</dt>
      <dd className="flex flex-1 flex-col gap-1">
        <span className="text-[1.75rem] text-foreground tabular-nums leading-none tracking-tight">
          {value}
        </span>
        {detail && (
          <span className="text-muted-foreground text-xs">{detail}</span>
        )}
        {children && <span className="mt-auto pt-3">{children}</span>}
      </dd>
    </div>
  );
}
