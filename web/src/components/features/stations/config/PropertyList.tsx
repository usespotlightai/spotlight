import type { ReactNode } from 'react';

export const PROPERTY_GRID =
  'grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm leading-5';

export function PropertyList({ children }: { children: ReactNode }) {
  return <dl className={PROPERTY_GRID}>{children}</dl>;
}

export function Property({
  label,
  slot,
  children,
}: {
  label: string;
  slot?: string;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd data-slot={slot} className="min-w-0 text-foreground">
        {children}
      </dd>
    </>
  );
}
