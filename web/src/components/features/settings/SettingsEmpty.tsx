import type { ReactNode } from 'react';

type SettingsEmptyProps = {
  children: ReactNode;
  action: ReactNode;
};

export function SettingsEmpty({ children, action }: SettingsEmptyProps) {
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-muted-foreground text-sm">{children}</p>

      {action}
    </div>
  );
}
