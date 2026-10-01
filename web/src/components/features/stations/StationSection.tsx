import type { ReactNode } from 'react';

type StationSectionProps = {
  title: string;
  id?: string;
  children: ReactNode;
};

export function StationSection({ title, id, children }: StationSectionProps) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-2">
      <h2 className="font-medium text-foreground text-sm">{title}</h2>
      {children}
    </section>
  );
}
