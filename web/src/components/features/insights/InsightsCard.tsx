import { ChartNoAxesColumn, Table2 } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { Button } from '@/components/ui/button';

type InsightsCardProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  table?: ReactNode;
  children: ReactNode;
};

export function InsightsCard({
  title,
  description,
  actions,
  table,
  children,
}: InsightsCardProps) {
  const titleId = useId();
  const [tabled, setTabled] = useState(false);

  return (
    <section
      aria-labelledby={titleId}
      data-slot="insights-card"
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-3"
    >
      <header className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={titleId} className="font-medium text-foreground text-sm">
            {title}
          </h2>
          {description && (
            <p className="text-muted-foreground text-xs">{description}</p>
          )}
        </div>

        {actions}

        {table && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            aria-pressed={tabled}
            onClick={() => setTabled((was) => !was)}
          >
            {tabled ? (
              <ChartNoAxesColumn aria-hidden />
            ) : (
              <Table2 aria-hidden />
            )}
            {tabled ? 'Show chart' : 'Show table'}
          </Button>
        )}
      </header>

      {table && tabled ? table : children}
    </section>
  );
}
