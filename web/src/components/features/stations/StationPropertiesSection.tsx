import type { ReactNode } from 'react';

type StationPropertiesSectionProps = {
  title: string;
  children: ReactNode;
};

export function StationPropertiesSection({
  title,
  children,
}: StationPropertiesSectionProps) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="px-2 font-medium text-muted-foreground text-xs">
        {title}
      </h2>

      {children}
    </section>
  );
}
