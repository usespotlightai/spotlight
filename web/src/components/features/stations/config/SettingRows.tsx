import type { ReactNode } from 'react';

export type SettingRow = {
  readonly label: string;
  readonly value: ReactNode;
};

export function SettingRows({ rows }: { rows: readonly SettingRow[] }) {
  return (
    <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm leading-6">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
