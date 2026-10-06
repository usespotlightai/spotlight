import { ChartNoAxesColumn, Table2 } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { CardTitle } from '@/components/features/insights/CardHeading';
import { Button } from '@/components/ui/button';
import { CardHeadingContext, type CardHeadingParts } from '@/lib/card-heading';

type InsightsCardProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  table?: ReactNode;
  tableOnly?: boolean;
  children: ReactNode;
};

export function InsightsCard({
  title,
  description,
  actions,
  toolbar,
  table,
  tableOnly = false,
  children,
}: InsightsCardProps) {
  const titleId = useId();
  const [tabled, setTabled] = useState(false);
  const showing = table && tabled ? table : children;
  const merged = !toolbar && (tableOnly || Boolean(table && tabled));

  const controls = (actions || table) && (
    <>
      {actions}
      {table && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-pressed={tabled}
          onClick={() => setTabled((was) => !was)}
        >
          {tabled ? <ChartNoAxesColumn aria-hidden /> : <Table2 aria-hidden />}
          {tabled ? 'Show chart' : 'Show table'}
        </Button>
      )}
    </>
  );

  const heading: CardHeadingParts = { titleId, title, description, controls };

  return (
    <section
      aria-labelledby={titleId}
      data-slot="insights-card"
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      {merged ? (
        <CardHeadingContext value={heading}>{showing}</CardHeadingContext>
      ) : (
        <>
          <header className="flex min-h-8 flex-wrap items-center gap-2 border-border border-b bg-muted/40 px-2.5 py-1">
            <div className="flex min-w-0 flex-1 items-center">
              <CardTitle heading={heading} as="h2" />
            </div>
            {controls}
          </header>

          {toolbar && (
            <div className="border-border border-b px-2.5 py-1.5">
              {toolbar}
            </div>
          )}

          {table && tabled ? (
            table
          ) : (
            <div className="flex min-w-0 flex-col gap-2 p-2.5">{children}</div>
          )}
        </>
      )}
    </section>
  );
}
