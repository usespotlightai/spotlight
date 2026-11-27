import type { ReactElement, ReactNode } from 'react';

export function SettingsEmpty({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}
