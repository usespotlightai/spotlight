import type { ReactElement, ReactNode } from 'react';

export function IntegrationFacts({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <dl className="flex flex-col gap-1 pt-3 pr-4 pb-4 pl-4 @md/pane:pl-12">
      {children}
    </dl>
  );
}
