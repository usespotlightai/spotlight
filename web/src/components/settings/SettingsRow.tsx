import type { ReactNode } from 'react';

type SettingsRowProps = {
  /** A small mark that belongs to the name, shown just before it. */
  mark?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
};

export function SettingsRow({
  mark,
  title,
  description,
  trailing,
}: SettingsRowProps) {
  return (
    <li data-slot="settings-row" className="flex items-center gap-3 py-1.5">
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex min-w-0 items-center gap-2">
          {/* As tall as the name's line box, so the mark centres on the
              text rather than sitting on its baseline. */}
          {mark && (
            <span className="flex h-4 shrink-0 items-center">{mark}</span>
          )}

          <span className="truncate font-medium text-foreground text-xs">
            {title}
          </span>
        </span>

        {description && (
          <span className="min-w-0 text-muted-foreground text-xs">
            {description}
          </span>
        )}
      </span>

      {trailing && (
        <span className="shrink-0 text-muted-foreground text-xs">
          {trailing}
        </span>
      )}
    </li>
  );
}
