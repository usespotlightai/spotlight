import { Fragment } from 'react';
import { AgentConfigRow } from '@/components/features/insights/changes/AgentConfigRow';
import { FoldingRows } from '@/components/shared/nested-table/FoldingRows';
import { NestedGroupRow } from '@/components/shared/nested-table/NestedGroupRow';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { useFolds } from '@/hooks/useFolds';
import type { HarnessResponseDto } from '@/lib/api';
import { formatHarness } from '@/lib/insights';
import {
  type AgentConfigOutcome,
  agentConfigHeadings,
  agentConfigKey,
  harnessGroupsOf,
  type OutcomeMeasure,
} from '@/lib/insights-changes';

type AgentConfigTableProps = {
  agentConfigs: readonly AgentConfigOutcome[];
  measure: OutcomeMeasure;
  harnesses: readonly HarnessResponseDto[] | undefined;
  judged: boolean;
};

export function AgentConfigTable({
  agentConfigs,
  measure,
  harnesses,
  judged,
}: AgentConfigTableProps) {
  const folds = useFolds();

  return (
    <NestedTable
      label="Harness, model, effort and profile"
      headings={agentConfigHeadings(judged)}
    >
      {harnessGroupsOf(agentConfigs).map((group) => {
        const name = formatHarness(harnesses, group.harness);
        const open = folds.isOpen(group.harness);

        return (
          <Fragment key={group.harness}>
            <NestedGroupRow
              label={name}
              open={open}
              depth={0}
              onToggle={() => folds.toggle(group.harness)}
            >
              <span className="font-medium text-foreground">{name}</span>
            </NestedGroupRow>
            <FoldingRows open={open}>
              {group.agentConfigs.map((agentConfig) => (
                <AgentConfigRow
                  key={agentConfigKey(agentConfig)}
                  agentConfig={agentConfig}
                  measure={measure}
                  judged={judged}
                />
              ))}
            </FoldingRows>
          </Fragment>
        );
      })}
    </NestedTable>
  );
}
