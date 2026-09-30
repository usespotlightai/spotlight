import type { ReactNode } from 'react';

type StationSectionProps = {
  title: string;
  children: ReactNode;
};

export function StationSection({ title, children }: StationSectionProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium text-foreground text-sm">{title}</h2>
      {children}
    </section>
  );
}
