import { Property } from '@/components/features/stations/config/PropertyList';
import { ReplayRunsDialog } from '@/components/features/stations/config/ReplayRunsDialog';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { useStationImprovement } from '@/hooks/api/useStationImprovement';
import { healthReadingsOf } from '@/lib/replay-words';
import { since } from '@/lib/since';
import {
  formatFreshTasks,
  formatScoring,
  formatSearchState,
  formatSetSize,
  formatTrigger,
  formatWhen,
  FRESH_TASKS_NOTE,
  replayRunsOf,
  type StationImprovement,
} from '@/lib/station-improvement';
import type { TooltipNote } from '@/lib/tooltip-note';

const NOT_RUN = new Set(['unknown', 'pending']);

const SET_NOTE =
  'The past runs Spotlight replays a config on, one run of each task. Spotlight adds the station’s new runs to it.';

const NO_SET_NOTE =
  'Spotlight starts a replay set when a run of the station ends.';

const healthNote = (
  set: NonNullable<StationImprovement['set']>,
): TooltipNote => ({
  title: 'Replay set health',
  body: SET_NOTE,
  rows: healthReadingsOf(set, set.minGain).map((each) => [
    each.label,
    NOT_RUN.has(each.tone) ? 'Not run yet' : each.text,
  ]),
});

type ImprovementStatusProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
};

export function ImprovementStatus({
  slug,
  teamId,
  lineId,
  stationId,
}: ImprovementStatusProps) {
  const { data } = useStationImprovement(teamId, lineId, stationId);

  if (!data) {
    return null;
  }

  const { set, scoring, lastSearch, nextSearchAt, lastSkip } = data;

  return (
    <>
      <Property label="Replay set" slot="replay-set">
        <span className="inline-flex items-center gap-1.5">
          {set ? formatSetSize(set) : 'None yet'}
          <InfoTooltip tooltip={set ? healthNote(set) : NO_SET_NOTE} />
        </span>
      </Property>

      {set?.fresh && (
        <Property label="Fresh tasks" slot="fresh-tasks">
          <span className="inline-flex items-center gap-1.5">
            {formatFreshTasks(set.fresh)}
            <InfoTooltip tooltip={FRESH_TASKS_NOTE} />
          </span>
        </Property>
      )}

      {scoring && (
        <Property label="Scored by" slot="scoring">
          {formatScoring(scoring)}
        </Property>
      )}

      <Property label="Last search" slot="last-search">
        {lastSearch ? (
          <span className="flex flex-col gap-1">
            <span>{formatSearchState(lastSearch.state)}</span>
            <span className="text-muted-foreground">
              Started {since(lastSearch.startedAt)},{' '}
              {formatTrigger(lastSearch.trigger)}
            </span>
            {lastSearch.result !== null && (
              <span className="text-muted-foreground">{lastSearch.result}</span>
            )}
            {replayRunsOf(lastSearch) > 0 && (
              <ReplayRunsDialog
                slug={slug}
                teamId={teamId}
                search={lastSearch}
              />
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">None yet</span>
        )}
      </Property>

      {nextSearchAt !== null && (
        <Property label="Next search" slot="next-search">
          {formatWhen(nextSearchAt)}
        </Property>
      )}

      {lastSkip && (
        <Property label="Last skipped" slot="last-skip">
          <span className="flex flex-col gap-1">
            <span>{lastSkip.text}</span>
            <span className="text-muted-foreground">
              {since(lastSkip.at)}. Looks again: {formatWhen(lastSkip.retryAt)}
            </span>
          </span>
        </Property>
      )}
    </>
  );
}
