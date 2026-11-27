import type { ReactElement } from 'react';
export function MemoryCellLabel({
  children,
}: {
  children: string;
}): ReactElement {
  return (
    <span className="text-muted-foreground text-xs leading-4 @4xl/pane:hidden">
      {children}
    </span>
  );
}
