import type { ReactNode } from 'react';

export function SettingsEmpty({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}
