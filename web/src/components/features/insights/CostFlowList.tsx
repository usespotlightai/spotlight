import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { spentIn } from '@/lib/inbox';
import type { FlowLinkRow } from '@/lib/insights';

const SHOWN = 5;

type CostFlowListProps = {
  rows: readonly FlowLinkRow[];
  currency: string;
};

const stagesOf = (rows: readonly FlowLinkRow[]) => {
  const stages = new Map<string, FlowLinkRow[]>();
  for (const row of rows) {
    stages.set(row.stage, [...(stages.get(row.stage) ?? []), row]);
  }

  return [...stages].map(([stage, flows]) => {
    const bySource = new Map<string, number>();
    for (const flow of flows) {
      bySource.set(flow.from, (bySource.get(flow.from) ?? 0) + flow.amount);
    }

    return {
      stage,
      total: flows.reduce((sum, flow) => sum + flow.amount, 0),
      flows: flows.toSorted(
        (one, other) =>
          (bySource.get(other.from) ?? 0) - (bySource.get(one.from) ?? 0) ||
          one.from.localeCompare(other.from) ||
          other.amount - one.amount,
      ),
    };
  });
};

export function CostFlowList({ rows, currency }: CostFlowListProps) {
  return (
    <div className="flex flex-col gap-4">
      {stagesOf(rows).map((stage) => (
        <StageFlows key={stage.stage} currency={currency} {...stage} />
      ))}
    </div>
  );
}

type StageFlowsProps = {
  stage: string;
  total: number;
  flows: readonly FlowLinkRow[];
  currency: string;
};

function StageFlows({ stage, total, flows, currency }: StageFlowsProps) {
  const [all, setAll] = useState(false);
  const shown = all ? flows : flows.slice(0, SHOWN);

  return (
    <section className="flex flex-col gap-1">
      <h4 className="text-muted-foreground text-xs">{stage}</h4>
      <ul aria-label={stage} className="flex flex-col">
        {shown.map((flow) => (
          <li
            key={`${flow.from}→${flow.to}`}
            data-slot="cost-flow"
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-1.5 text-sm"
          >
            <span
              className="truncate text-foreground"
              title={`${flow.from} → ${flow.to}`}
            >
              {flow.from}
              <span className="text-muted-foreground"> → </span>
              {flow.to}
            </span>
            <span className="text-foreground tabular-nums">
              {spentIn(flow.amount, currency)}
            </span>
            <span
              aria-hidden
              className="col-span-full h-1 overflow-hidden rounded-full bg-muted"
            >
              <span
                className="block h-full rounded-full bg-chart-primary"
                style={{
                  width: `${total > 0 ? (flow.amount / total) * 100 : 0}%`,
                }}
              />
            </span>
          </li>
        ))}
      </ul>
      {flows.length > SHOWN && (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2.5 self-start text-muted-foreground"
          onClick={() => setAll((open) => !open)}
        >
          {all ? 'Show fewer' : `Show all ${flows.length}`}
        </Button>
      )}
    </section>
  );
}
