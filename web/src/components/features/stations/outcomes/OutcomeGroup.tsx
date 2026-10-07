import { OutcomeTableRow } from '@/components/features/stations/outcomes/OutcomeTableRow';
import { Noted } from '@/components/shared/Noted';
import { FoldingRows } from '@/components/shared/nested-table/FoldingRows';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedGroupRow } from '@/components/shared/nested-table/NestedGroupRow';
import { Pill } from '@/components/shared/Pill';
import type { Folds } from '@/hooks/useFolds';
import { useBeforeAfterPanel } from '@/lib/before-after-panel';
import { pillClass } from '@/lib/pill';
import { runPath } from '@/lib/run';
import { type FingerprintGroup, groupSummary } from '@/lib/station-outcomes';

type OutcomeGroupProps = {
  slug: string;
  teamId: string;
  stationId: string;
  group: FingerprintGroup;
  folds: Folds;
};

export function OutcomeGroup({
  slug,
  teamId,
  stationId,
  group,
  folds,
}: OutcomeGroupProps) {
  const panel = useBeforeAfterPanel();
  const summary = groupSummary(group);
  const open = folds.isOpen(group.firstRunId);
  const name = (
    <span className="truncate font-medium text-foreground">
      {summary.name}
      {summary.more.length > 0 && (
        <span className="font-normal text-muted-foreground">
          {' '}
          +{summary.more.length} more
        </span>
      )}
    </span>
  );
  const shown =
    panel.shown?.stationId === stationId &&
    panel.shown.runId === group.firstRunId;

  return (
    <>
      <NestedGroupRow
        label={summary.name}
        open={open}
        depth={0}
        onToggle={() => folds.toggle(group.firstRunId)}
        cells={
          <>
            <span aria-hidden />
            <NestedCell heading="Checks" numeric={false} strong>
              {summary.checks}
            </NestedCell>
            <NestedCell heading="Next" numeric={false} strong>
              {summary.next}
            </NestedCell>
            <NestedCell heading="Delivery" numeric={false} strong>
              {summary.delivery}
            </NestedCell>
            <NestedCell heading="Took" strong>
              {summary.took}
            </NestedCell>
            <NestedCell heading="Cost" strong>
              {summary.cost}
            </NestedCell>
            <NestedCell heading="Ended">{summary.days ?? '–'}</NestedCell>
            {group.changes.length > 0 ? (
              <button
                type="button"
                aria-pressed={shown}
                onClick={() =>
                  shown
                    ? panel.close()
                    : panel.show({ stationId, runId: group.firstRunId })
                }
                className={pillClass(
                  'outline',
                  'h-5 justify-self-start whitespace-nowrap px-2 text-[0.7rem] @4xl:justify-self-end',
                )}
              >
                Impact
              </button>
            ) : (
              <span aria-hidden />
            )}
          </>
        }
      >
        <div
          data-slot="config-group"
          className="flex min-w-0 items-center gap-2"
        >
          {summary.note ? <Noted note={summary.note}>{name}</Noted> : name}
          {!group.ran && (
            <Noted note="No run started on this config. Its runs failed before starting or were withdrawn.">
              <span className="inline-flex shrink-0">
                <Pill className="py-0 pr-1.5 pl-1.5 text-[0.7rem] text-foreground">
                  Never started
                </Pill>
              </span>
            </Noted>
          )}
        </div>
      </NestedGroupRow>
      <FoldingRows open={open} label="Runs">
        {group.runs.map((run) => (
          <OutcomeTableRow
            key={run.runId}
            run={run}
            to={runPath(slug, teamId, run.runId)}
          />
        ))}
      </FoldingRows>
    </>
  );
}
