import type { ReactNode } from 'react';

type SummaryTileProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
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
      className="flex min-h-28 min-w-0 flex-col gap-1 rounded-lg border border-border px-4 py-3"
    >
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="flex flex-1 flex-col">
        <span className="flex items-baseline gap-1.5">
          <span className="font-medium text-foreground text-xl tabular-nums leading-7">
            {value}
          </span>
          {detail && (
            <span className="text-muted-foreground text-sm tabular-nums">
              {detail}
            </span>
          )}
        </span>
        {children && <span className="mt-auto pt-3">{children}</span>}
      </dd>
    </div>
  );
}
