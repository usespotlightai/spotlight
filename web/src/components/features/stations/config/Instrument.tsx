import { type ReactNode, useId } from 'react';

type InstrumentProps = {
  title: string;
  id?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function Instrument({ title, id, action, children }: InstrumentProps) {
  const titleId = useId();

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      data-slot="instrument"
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
