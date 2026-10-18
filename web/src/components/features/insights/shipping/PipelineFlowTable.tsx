import { Fragment } from 'react';
import { CollapsibleRows } from '@/components/shared/nested-table/CollapsibleRows';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedGroupRow } from '@/components/shared/nested-table/NestedGroupRow';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { useCollapsibles } from '@/hooks/useCollapsibles';
import { formatDurationOrNone } from '@/lib/insights';
import {
  type FlowStage,
  formatPart,
  STATION_STAGES,
} from '@/lib/insights-shipping';
import { SPREAD } from '@/lib/nested-table';
import { cn } from '@/lib/utils';

const GROUPS = [
  { id: 'stations', label: 'At the stations', station: true },
  { id: 'pull-request', label: 'On the pull request', station: false },
] as const;

const partHeading = (part: (typeof STATION_STAGES)[number]): string =>
  formatPart(part).replace(/^./, (first) => first.toUpperCase());

export function PipelineFlowTable({
  stages,
}: {
  stages: readonly FlowStage[];
}) {
  const collapsibles = useCollapsibles();
  const broken = stages.some((stage) => stage.parts);
  const headings = [
    { label: 'Stage', indent: 'outer' as const, size: 'minmax(10rem,2fr)' },
    { label: 'Time', numeric: true, size: SPREAD },
    ...(broken
      ? STATION_STAGES.map((part) => ({
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
        const open = collapsibles.isOpen(group.id);

        return grouped.length === 0 ? null : (
          <Fragment key={group.id}>
            <NestedGroupRow
              label={group.label}
              open={open}
              depth={0}
              onToggle={() => collapsibles.toggle(group.id)}
            >
              <span className="font-medium text-foreground">{group.label}</span>
            </NestedGroupRow>
            <CollapsibleRows open={open} label={group.label}>
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
                    {stage.worst && (
                      <WithTooltip tooltip="Worst bottleneck: the stage with the longest wait">
                        <span className="inline-flex shrink-0">
                          <span
                            role="img"
                            aria-label="Worst bottleneck"
                            className="size-1.5 rounded-full bg-destructive"
                          />
                        </span>
                      </WithTooltip>
                    )}
                  </span>
                  <NestedCell heading="Time" strong>
                    {formatDurationOrNone(stage.ms)}
                  </NestedCell>
                  {broken &&
                    STATION_STAGES.map((part) => (
                      <NestedCell key={part} heading={partHeading(part)}>
                        {stage.parts
                          ? formatDurationOrNone(stage.parts[part])
                          : '–'}
                      </NestedCell>
                    ))}
                </li>
              ))}
            </CollapsibleRows>
          </Fragment>
        );
      })}
    </NestedTable>
  );
}
