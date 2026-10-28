import { type ReactNode, useId, useState } from 'react';
import { CardTitle } from '@/components/features/insights/CardHeading';
import { ChartTableSwitch } from '@/components/features/insights/ChartTableSwitch';
import { OverflowFade } from '@/components/shared/OverflowFade';
import type { TooltipText } from '@/lib/tooltip-note';
import { cn } from '@/lib/utils';

const TABLE_HEIGHT = 'max-h-96';

type InsightsCardProps = {
  title: string;
  id?: string;
  description?: TooltipText;
  actions?: ReactNode;
  table?: ReactNode;
  tableOnly?: boolean;
  level?: 2 | 3;
  scrolls?: boolean;
  className?: string;
  children: ReactNode;
};

export function InsightsCard({
  title,
  id,
  description,
  actions,
  table,
  tableOnly = false,
  level,
  scrolls = false,
  className,
  children,
}: InsightsCardProps) {
  const titleId = useId();
  const [tabled, setTabled] = useState(false);
  const tabling = Boolean(table && tabled);
  const capped = (body: ReactNode) => (
    <OverflowFade className={TABLE_HEIGHT}>{body}</OverflowFade>
  );
  const shown = scrolls ? capped(children) : children;

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      data-slot="insights-card"
      className={cn(
        'flex min-w-0 scroll-mt-4 flex-col overflow-hidden rounded-lg border border-border bg-card',
        className,
      )}
    >
      <header className="flex min-h-6 flex-wrap items-center gap-2 px-3 pt-3 pb-4">
        <div className="flex min-w-0 flex-1 items-center">
          <CardTitle
            titleId={titleId}
            title={title}
            description={description}
            level={level}
          />
        </div>
        {actions}
        {table && <ChartTableSwitch tabled={tabled} onTabled={setTabled} />}
      </header>

      {tabling || tableOnly ? (
        <div className="flex min-w-0 flex-1 flex-col px-3 pb-3">
          {tabling ? capped(table) : shown}
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 pb-3">
          {shown}
        </div>
      )}
    </section>
  );
}
