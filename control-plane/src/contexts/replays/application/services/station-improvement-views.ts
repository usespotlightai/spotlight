import type { StationImprovementDto } from '@replays/application/dto/station-improvements.dto';
import { configPullRequestReasonView } from '@replays/application/services/config-pull-request-views';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import type { StationImprovement } from '@replays/domain/services/station-improvement';
import { FEWEST_SEARCH_TASKS } from '@replays/domain/value-objects/held-out-split.vo';

const blockOf = (improvement: StationImprovement) =>
  improvement.status === 'not-improving' ? improvement.block : null;

export const stationImprovementView = (
  improvement: StationImprovement,
  set: ReplaySet | null,
  schedule: StationSearchSchedule | null,
): StationImprovementDto => {
  const block = blockOf(improvement);

  return {
    status: improvement.status,
    searchId:
      improvement.status === 'searching' || improvement.status === 'picking'
        ? improvement.searchId.value
        : null,
    pickPhase: improvement.status === 'picking' ? improvement.phase : null,
    pullRequestUrl:
      improvement.status === 'pull-request-open' ||
      improvement.status === 'improved'
        ? improvement.url
        : null,
    improvedAt:
      improvement.status === 'improved' ? improvement.at.toISOString() : null,
    skip:
      block?.kind === 'skip'
        ? { reason: block.skip.reason, at: block.skip.at.toISOString() }
        : null,
    pullRequestFailure:
      block?.kind === 'pull-request-failed'
        ? configPullRequestReasonView(block.reason)
        : null,
    minimumTasks: FEWEST_SEARCH_TASKS,
    setId: set?.id.value ?? null,
    lastStartedAt: schedule?.lastStartedAt?.toISOString() ?? null,
    checkAfter: schedule?.checkAfter.toISOString() ?? null,
  };
};
