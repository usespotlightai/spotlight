import type { ReactNode } from 'react';

export function InsightsTiles({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <dl
      aria-label={label}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
    >
      {children}
    </dl>
  );
}
