import type { SuggestedRunDto } from '@replays/application/dto/replays.dto';
import type { OutcomesPort } from '@replays/application/ports/outcomes.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ListReplaySetSuggestionsQuery } from '@replays/application/queries/list-replay-set-suggestions.query';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { MOST_SET_ENTRIES } from '@replays/domain/aggregates/replay-set.aggregate';
import { turnedOutOf } from '@replays/domain/services/composition';
import {
  balancingPicks,
  MOST_SUGGESTED,
  newestOfEachTask,
} from '@replays/domain/services/set-suggestions';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

const MOST_SUGGESTED_FROM = 50;

export class ListReplaySetSuggestionsHandler
  implements
    QueryHandlerPort<ListReplaySetSuggestionsQuery, readonly SuggestedRunDto[]>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly work: WorkPort,
    private readonly outcomes: OutcomesPort,
  ) {}

  async execute(
    query: ListReplaySetSuggestionsQuery,
  ): Promise<readonly SuggestedRunDto[]> {
    try {
      const clearance = await this.access.clearance(
        query.teamId,
        query.principal,
      );
      const set = await this.access.setOn(clearance, query.setId);

      if (set.isAtGoneStation) {
        return [];
      }

      const recent = newestOfEachTask(
        (
          await this.work.recentAt(
            clearance.workspaceId,
            set.station.stationId,
            MOST_SUGGESTED_FROM,
          )
        ).flatMap((each) =>
          each.refusal === null && each.taskId && !set.holds(each.runId)
            ? [{ ...each, task: each.taskId.value }]
            : [],
        ),
        set.entries.map((each) => each.taskId.value),
      );
      const turnouts = await this.outcomes.turnedOut([
        ...set.runs,
        ...recent.map((each) => each.runId),
      ]);

      return balancingPicks(
        set.runs.map((each) => turnedOutOf(turnouts, each.value)),
        recent.map((each) => ({
          run: each,
          outcome: turnedOutOf(turnouts, each.runId.value),
        })),
        Math.min(MOST_SUGGESTED, MOST_SET_ENTRIES - set.entries.length),
      ).map(({ run, outcome }) => ({
        runId: run.runId.value,
        taskId: run.task,
        title: run.title,
        state: run.state,
        endedAt: run.endedAt.toISOString(),
        refusal: run.refusal,
        reason: run.reason,
        outcome,
      }));
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
