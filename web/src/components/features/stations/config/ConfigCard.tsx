import { type ReactNode, useId } from 'react';

type ConfigCardProps = {
  title: string;
  id?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function ConfigCard({ title, id, action, children }: ConfigCardProps) {
  const titleId = useId();

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      data-slot="config-card"
      className="flex min-w-0 scroll-mt-4 flex-col gap-3 rounded-lg border border-border bg-card p-3"
    >
      <header className="flex min-h-6 items-center justify-between gap-2">
        <h3 id={titleId} className="text-foreground text-xs">
          {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}
