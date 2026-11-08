import type { PullRequestState } from '@insights/domain/value-objects/pull-request-state';
import type { TaskPullRequestFact } from '@insights/domain/value-objects/run-fact.vo';

const newestFirst = (
  one: TaskPullRequestFact,
  other: TaskPullRequestFact,
): number =>
  other.openedAt.getTime() - one.openedAt.getTime() ||
  other.pullRequest.value.localeCompare(one.pullRequest.value);

const earliestOf = (dates: readonly (Date | null)[]): Date | null =>
  dates.reduce<Date | null>(
    (earliest, each) =>
      each && (!earliest || each.getTime() < earliest.getTime())
        ? each
        : earliest,
    null,
  );

const latestOf = (dates: readonly (Date | null)[]): Date | null =>
  dates.reduce<Date | null>(
    (latest, each) =>
      each && (!latest || each.getTime() > latest.getTime()) ? each : latest,
    null,
  );

const combinedStateOf = (
  owned: readonly TaskPullRequestFact[],
): PullRequestState => {
  if (owned.some((each) => each.state === 'open')) {
    return 'open';
  }

  return owned.every((each) => each.state === 'merged') ? 'merged' : 'closed';
};

export const taskPullRequestOf = (
  owned: readonly TaskPullRequestFact[],
): TaskPullRequestFact | null => {
  const all = [...owned].sort(newestFirst);
  const [newest] = all;

  if (!newest) {
    return null;
  }

  const state = combinedStateOf(all);
  const shown =
    state === 'open'
      ? (all.find((each) => each.state === 'open') ?? newest)
      : newest;

  return {
    workspaceId: shown.workspaceId,
    taskId: shown.taskId,
    teamId: shown.teamId,
    pullRequest: shown.pullRequest,
    state,
    openedAt: earliestOf(all.map((each) => each.openedAt)) ?? newest.openedAt,
    firstReviewAt: earliestOf(all.map((each) => each.firstReviewAt)),
    closedAt:
      state === 'open' ? null : latestOf(all.map((each) => each.closedAt)),
  };
};
