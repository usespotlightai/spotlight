import { type ReactNode, useId } from 'react';

type TabSectionProps = {
  title: string;
  id?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function TabSection({ title, id, action, children }: TabSectionProps) {
  const titleId = useId();

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      data-slot="tab-section"
      className="flex min-w-0 scroll-mt-4 flex-col gap-3"
    >
      <header className="flex min-h-6 items-center justify-between gap-2">
        <h3 id={titleId} className="font-medium text-foreground text-sm">
          {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}
