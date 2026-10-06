import { Fragment } from 'react';
import { Noted } from '@/components/shared/Noted';
import { FoldingRows } from '@/components/shared/nested-table/FoldingRows';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedGroupRow } from '@/components/shared/nested-table/NestedGroupRow';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import { useFolds } from '@/hooks/useFolds';
import { lastedOrNone } from '@/lib/insights';
import {
  type FlowStage,
  partShown,
  STATION_PARTS,
  worstJam,
} from '@/lib/insights-shipping';
import { SPREAD } from '@/lib/nested-table';
import { cn } from '@/lib/utils';

const GROUPS = [
  { id: 'stations', label: 'At the stations', station: true },
  { id: 'pull-request', label: 'On the pull request', station: false },
] as const;

const partHeading = (part: (typeof STATION_PARTS)[number]): string =>
  partShown(part).replace(/^./, (first) => first.toUpperCase());

export function PipelineFlowTable({
  stages,
}: {
  stages: readonly FlowStage[];
}) {
  const folds = useFolds();
  const worst = worstJam(stages);
  const broken = stages.some((stage) => stage.parts);
  const headings = [
    { label: 'Stage', indent: 'outer' as const, size: 'minmax(10rem,2fr)' },
    { label: 'Time', numeric: true, size: SPREAD },
    ...(broken
      ? STATION_PARTS.map((part) => ({
          label: partHeading(part),
          numeric: true,
          size: SPREAD,
        }))
      : []),
  ];

  return (
    <NestedTable label="Flow through the pipeline" headings={headings}>
      {GROUPS.map((group) => {
        const grouped = stages.filter(
          (stage) => stage.station === group.station,
        );
        const open = folds.isOpen(group.id);

        return grouped.length === 0 ? null : (
          <Fragment key={group.id}>
            <NestedGroupRow
              label={group.label}
              open={open}
              depth={0}
              onToggle={() => folds.toggle(group.id)}
            >
              <span className="font-medium text-foreground">{group.label}</span>
            </NestedGroupRow>
            <FoldingRows open={open} label={group.label}>
              {grouped.map((stage) => (
                <li
                  key={stage.id}
                  data-slot="flow-stage"
                  className={cn(
                    'relative col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 text-xs @4xl:grid-cols-subgrid',
                    OUTER_GUIDE,
                    OUTER_DIVIDER,
                  )}
                >
                  <span
                    className={cn(
                      'col-span-full flex min-w-0 items-center gap-2 text-foreground @4xl:col-span-1',
                      OUTER_INDENT,
                    )}
                  >
                    {stage.label}
                    {stage === worst && (
                      <Noted note="Worst jam: the stage with the longest wait">
                        <span className="inline-flex shrink-0">
                          <span
                            role="img"
                            aria-label="Worst jam"
                            className="size-1.5 rounded-full bg-destructive"
                          />
                        </span>
                      </Noted>
                    )}
                  </span>
                  <NestedCell heading="Time" strong>
                    {lastedOrNone(stage.ms)}
                  </NestedCell>
                  {broken &&
                    STATION_PARTS.map((part) => (
                      <NestedCell key={part} heading={partHeading(part)}>
                        {stage.parts ? lastedOrNone(stage.parts[part]) : '–'}
                      </NestedCell>
                    ))}
                </li>
              ))}
            </FoldingRows>
          </Fragment>
        );
      })}
    </NestedTable>
  );
}
