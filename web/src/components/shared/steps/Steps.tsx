import type { ReactNode, ReactElement } from 'react';

export function Steps({ children }: { children: ReactNode }): ReactElement {
  return <ol className="flex flex-col [counter-reset:step]">{children}</ol>;
}
