import type { ReactNode } from 'react';

type SettingsRowProps = {
  label: string;
  description?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
};

export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
}: SettingsRowProps) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        {htmlFor ? (
          <label
            htmlFor={htmlFor}
            className="font-medium text-foreground text-sm"
          >
            {label}
          </label>
        ) : (
          <span className="font-medium text-foreground text-sm">{label}</span>
        )}

        {description && (
          <span className="text-muted-foreground text-xs">{description}</span>
        )}
      </div>

      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}
