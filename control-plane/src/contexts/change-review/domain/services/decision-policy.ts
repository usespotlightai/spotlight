import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';

export interface DecidedTask {
  readonly reviewing: boolean;
}

export interface TaskWithFirstPullRequest {
  readonly pullRequest: PullRequestUrl | null;
}

export interface DecidedRun {
  readonly decisions: boolean;
  readonly completed: boolean;
}

export const keepsDecisions = (task: DecidedTask): boolean => !task.reviewing;

export const discardsDecisionsOnClose = (
  task: TaskWithFirstPullRequest,
  closed: PullRequestUrl,
): boolean => task.pullRequest?.equals(closed) ?? false;

export const decidesFrom = (run: DecidedRun, task: DecidedTask): boolean =>
  run.decisions && run.completed && keepsDecisions(task);
