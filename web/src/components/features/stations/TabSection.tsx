import { type ReactNode, useId } from 'react';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import type { TooltipText } from '@/lib/tooltip-note';

type TabSectionProps = {
  title: string;
  id?: string;
  description?: TooltipText;
  action?: ReactNode;
  children: ReactNode;
};

export function TabSection({
  title,
  id,
  description,
  action,
  children,
}: TabSectionProps) {
  const titleId = useId();

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      data-slot="tab-section"
      className="flex min-w-0 scroll-mt-4 flex-col gap-3"
    >
      <header className="flex min-h-6 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <h2 id={titleId} className="font-medium text-foreground text-sm">
            {title}
          </h2>
          {description && <InfoTooltip tooltip={description} />}
        </span>
        {action}
      </header>
      {children}
    </section>
  );
}
