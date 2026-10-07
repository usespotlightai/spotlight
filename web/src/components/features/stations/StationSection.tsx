import type { ReactNode } from 'react';

type StationSectionProps = {
  title: string;
  id?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function StationSection({
  title,
  id,
  action,
  children,
}: StationSectionProps) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-2">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h2 className="font-medium text-foreground text-sm">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
