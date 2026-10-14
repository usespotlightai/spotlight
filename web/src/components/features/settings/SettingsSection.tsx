import type { ReactNode } from 'react';

type SettingsSectionProps = {
  title?: string;
  count?: number;
  action?: ReactNode;
  listLabel?: string;
  children: ReactNode;
};

export function SettingsSection({
  title,
  count,
  action,
  listLabel,
  children,
}: SettingsSectionProps) {
  const Body = listLabel ? 'ul' : 'div';

  return (
    <section className="flex flex-col gap-3">
      {(title || count !== undefined || action) && (
        <div className="flex min-h-7 items-center justify-between gap-2.5">
          <h2 className="flex items-center gap-2.5 font-medium text-foreground text-sm">
            {title}
            {count !== undefined && (
              <span className="font-normal text-muted-foreground tabular-nums">
                {count}
              </span>
            )}
          </h2>

          {action}
        </div>
      )}

      <Body
        aria-label={listLabel}
        className="divide-y-[0.5px] divide-border overflow-hidden rounded-xl border-[0.5px] border-border bg-card"
      >
        {children}
      </Body>
    </section>
  );
}
