import type { ReactElement, ReactNode } from 'react';

import { InfoTooltip } from '@/components/shared/InfoTooltip';
import type { TooltipText } from '@/lib/tooltip-note';

type SettingsSectionProps = {
  id?: string;
  title?: string;
  description?: TooltipText;
  count?: number;
  action?: ReactNode;
  listLabel?: string;
  children: ReactNode;
};

export function SettingsSection({
  id,
  title,
  description,
  count,
  action,
  listLabel,
  children,
}: SettingsSectionProps): ReactElement {
  const Body = listLabel !== undefined && listLabel !== '' ? 'ul' : 'div';

  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-3">
      {((title !== undefined && title !== '') ||
        count !== undefined ||
        Boolean(action)) && (
        <div className="flex min-h-7 items-center justify-between gap-2.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <h2 className="flex items-center gap-2.5 font-medium text-foreground text-sm">
              {title}
              {count !== undefined && (
                <span className="font-normal text-muted-foreground tabular-nums">
                  {count}
                </span>
              )}
            </h2>
            {description !== undefined && description !== '' && (
              <InfoTooltip tooltip={description} />
            )}
          </span>

          {action}
        </div>
      )}

      <Body
        aria-label={listLabel}
        className="divide-y-[0.5px] divide-border overflow-hidden rounded-xl border-[0.5px] border-border bg-card"
      >
        {children}
      </Body>
    </section>
  );
}
