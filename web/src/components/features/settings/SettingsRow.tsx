import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type SettingsRowProps = {
  label: string;
  description?: ReactNode;
  htmlFor?: string;
  leading?: ReactNode;
  stack?: boolean;
  children?: ReactNode;
};

const LABEL = 'break-words font-medium text-foreground text-sm';

export function SettingsRow({
  label,
  description,
  htmlFor,
  leading,
  stack = false,
  children,
}: SettingsRowProps) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-2">
      {leading}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2',
          stack && '@max-md/pane:flex-col @max-md/pane:items-start',
        )}
      >
        <div
          className={cn(
            'flex min-w-0 max-w-full flex-1 basis-36 flex-col gap-0.5',
            stack && '@max-md/pane:basis-auto',
          )}
        >
          {htmlFor ? (
            <label htmlFor={htmlFor} className={LABEL}>
              {label}
            </label>
          ) : (
            <span className={LABEL}>{label}</span>
          )}

          {description && (
            <span className="break-words text-muted-foreground text-xs">
              {description}
            </span>
          )}
        </div>

        {children && (
          <div className="flex shrink-0 items-center">{children}</div>
        )}
      </div>
    </div>
  );
}
