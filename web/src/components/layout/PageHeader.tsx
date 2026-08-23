import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b-[0.5px] border-border px-4">
      <h1 className="flex min-w-0 items-center gap-1.5 font-medium text-foreground text-sm">
        {title}
      </h1>
      {actions && (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
