import { Fragment } from 'react';
import { SetupRow } from '@/components/features/insights/changes/SetupRow';
import { FoldingRows } from '@/components/shared/nested-table/FoldingRows';
import { NestedGroupRow } from '@/components/shared/nested-table/NestedGroupRow';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { useFolds } from '@/hooks/useFolds';
import type { HarnessResponseDto } from '@/lib/api';
import { harnessShown } from '@/lib/insights';
import {
  harnessGroupsOf,
  type OutcomeMeasure,
  type SetupOutcome,
  setupHeadings,
  setupKey,
} from '@/lib/insights-changes';

type SetupTableProps = {
  setups: readonly SetupOutcome[];
  measure: OutcomeMeasure;
  harnesses: readonly HarnessResponseDto[] | undefined;
  judged: boolean;
};

export function SetupTable({
  setups,
  measure,
  harnesses,
  judged,
}: SetupTableProps) {
  const folds = useFolds();

  return (
    <NestedTable
      label="Harness, model, effort and profile"
      headings={setupHeadings(judged)}
    >
      {harnessGroupsOf(setups).map((group) => {
        const name = harnessShown(harnesses, group.harness);
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
              {group.setups.map((setup) => (
                <SetupRow
                  key={setupKey(setup)}
                  setup={setup}
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
