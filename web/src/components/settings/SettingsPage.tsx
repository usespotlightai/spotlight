import type { ReactNode } from 'react';

type SettingsPageProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

export function SettingsPage({
  title,
  description,
  children,
}: SettingsPageProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 py-8">
        <div className="flex flex-col gap-3">
          <h1 className="font-semibold text-2xl text-foreground leading-8 tracking-tight">
            {title}
          </h1>

          {description && (
            <p className="text-muted-foreground text-sm leading-6">
              {description}
            </p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
