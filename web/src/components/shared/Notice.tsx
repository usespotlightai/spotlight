import type { ReactNode, ReactElement } from 'react';

export function Notice({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center @md/pane:p-8">
      {children}
    </div>
  );
}
