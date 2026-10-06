import { type ReactNode, useId, useState } from 'react';
import { CardTitle } from '@/components/features/insights/CardHeading';
import { ChartTableSwitch } from '@/components/features/insights/ChartTableSwitch';

type InsightsCardProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  table?: ReactNode;
  tableOnly?: boolean;
  children: ReactNode;
};

export function InsightsCard({
  title,
  description,
  actions,
  table,
  tableOnly = false,
  children,
}: InsightsCardProps) {
  const titleId = useId();
  const [tabled, setTabled] = useState(false);
  const tabling = Boolean(table && tabled);

  return (
    <section
      aria-labelledby={titleId}
      data-slot="insights-card"
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <header className="flex min-h-6 flex-wrap items-center gap-2 px-3 pt-3 pb-4">
        <div className="flex min-w-0 flex-1 items-center">
          <CardTitle
            titleId={titleId}
            title={title}
            description={description}
          />
        </div>
        {actions}
        {table && <ChartTableSwitch tabled={tabled} onTabled={setTabled} />}
      </header>

      {tabling || tableOnly ? (
        <div className="min-w-0 px-3 pb-3">{tabling ? table : children}</div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 pb-3">
          {children}
        </div>
      )}
    </section>
  );
}
