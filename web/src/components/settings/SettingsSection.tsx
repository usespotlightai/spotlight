import type { ReactNode } from 'react';

type SettingsSectionProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
};

export function SettingsSection({
  title,
  action,
  children,
}: SettingsSectionProps) {
  return (
    <section className="flex flex-col gap-1">
      <div className="flex h-6 items-center gap-2">
        <h2 className="font-medium text-muted-foreground text-xs">{title}</h2>

        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>

      <ul className="flex flex-col">{children}</ul>
    </section>
  );
}
