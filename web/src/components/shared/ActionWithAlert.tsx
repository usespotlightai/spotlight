import type { ReactNode } from 'react';

type ActionWithAlertProps = {
  alert: string | null;
  children: ReactNode;
};

export function ActionWithAlert({ alert, children }: ActionWithAlertProps) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      {alert && (
        <span role="alert" className="text-destructive text-xs">
          {alert}
        </span>
      )}
      {children}
    </span>
  );
}
