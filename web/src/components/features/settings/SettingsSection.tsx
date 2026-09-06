import type { ReactNode } from 'react';

type SettingsSectionProps = {
  title?: string;
  count?: number;
  children: ReactNode;
};

export function SettingsSection({
  title,
  count,
  children,
}: SettingsSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      {(title || count !== undefined) && (
        <h2 className="flex items-center gap-2.5 font-medium text-foreground text-sm">
          {title}
          {count !== undefined && (
            <span className="font-normal text-muted-foreground tabular-nums">
              {count}
            </span>
          )}
        </h2>
      )}

      <div className="divide-y divide-border overflow-hidden rounded-xl border-[0.5px] border-border bg-card">
        {children}
      </div>
    </section>
  );
}
