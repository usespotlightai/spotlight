import { BestValueMark } from '@/components/features/insights/BestValueMark';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import { spentIn } from '@/lib/inbox';
import { formatCount } from '@/lib/insights';
import {
  type AgentConfigOutcome,
  formatAgentConfigWithin,
  formatOutcome,
  type OutcomeMeasure,
  shownMeasures,
} from '@/lib/insights-changes';
import { cn } from '@/lib/utils';

type AgentConfigRowProps = {
  agentConfig: AgentConfigOutcome;
  measure: OutcomeMeasure;
  judged: boolean;
};

export function AgentConfigRow({
  agentConfig,
  measure,
  judged,
}: AgentConfigRowProps) {
  return (
    <li
      data-slot="agent-config-row"
      className={cn(
        'relative col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 @4xl:grid-cols-subgrid',
        OUTER_GUIDE,
        OUTER_DIVIDER,
      )}
    >
      <div
        className={cn(
          'col-span-full flex min-w-0 items-center gap-2 @4xl:col-span-1',
          OUTER_INDENT,
        )}
      >
        <span className="min-w-0 truncate font-medium text-foreground text-xs">
          {formatAgentConfigWithin(agentConfig)}
        </span>
        {agentConfig.frontier.includes(measure) && <BestValueMark />}
      </div>
      <NestedCell heading="Runs">
        {formatCount(agentConfig.tally.runs)}
      </NestedCell>
      <NestedCell heading="Cost per run" strong>
        {agentConfig.costPerRun === null || !agentConfig.currency
          ? '–'
          : spentIn(agentConfig.costPerRun, agentConfig.currency)}
      </NestedCell>
      {shownMeasures(judged).map((each) => (
        <NestedCell
          key={each.id}
          heading={each.label}
          strong={each.id === measure}
        >
          {formatOutcome(agentConfig.outcomes[each.id])}
        </NestedCell>
      ))}
    </li>
  );
}
