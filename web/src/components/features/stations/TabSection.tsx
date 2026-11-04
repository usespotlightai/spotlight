import { type ReactNode, useId } from 'react';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import type { TooltipText } from '@/lib/tooltip-note';
import { cn } from '@/lib/utils';

type TabSectionProps = {
  title: string;
  id?: string;
  description?: TooltipText;
  level?: 2 | 3;
  action?: ReactNode;
  children: ReactNode;
};

export function TabSection({
  title,
  id,
  description,
  level = 2,
  action,
  children,
}: TabSectionProps) {
  const Heading = level === 3 ? 'h3' : 'h2';
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
          <Heading
            id={titleId}
            className={cn(
              'font-medium text-foreground',
              level === 3 ? 'text-sm' : 'text-base',
            )}
          >
            {title}
          </Heading>
          {description && <InfoTooltip tooltip={description} />}
        </span>
        {action}
      </header>
      {children}
    </section>
  );
}
