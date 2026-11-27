import type { ReactNode } from 'react';

type PageTitleProps = {
  lead?: ReactNode;
  children: ReactNode;
};

export function PageTitle({ lead, children }: PageTitleProps) {
  return (
    <h1 className="flex min-w-0 items-center gap-2.5 font-medium text-foreground text-xl leading-7">
      {lead}
      <span
        title={typeof children === 'string' ? children : undefined}
        className="truncate @max-xl/pane:line-clamp-2 @max-xl/pane:whitespace-normal @max-xl/pane:break-words"
      >
        {children}
      </span>
    </h1>
  );
}
