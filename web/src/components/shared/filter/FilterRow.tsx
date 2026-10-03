import type { ReactNode } from 'react';

type FilterRowProps = {
  label: string;
  htmlFor?: string;
  children: ReactNode;
};

export function FilterRow({ label, htmlFor, children }: FilterRowProps) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-muted-foreground text-sm">
          {label}
        </label>
      ) : (
        <span className="text-muted-foreground text-sm">{label}</span>
      )}

      {children}
    </div>
  );
}
