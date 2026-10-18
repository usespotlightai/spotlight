import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { TaskPullRequest } from '@insights/domain/aggregates/task-pull-request.aggregate';
import type { CheckVerdict } from '@insights/domain/value-objects/check-verdict';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import type { TaskPullRequestState } from '@insights/domain/value-objects/task-pull-request-state';

export interface RunUsageDto {
  readonly ms: number | null;
  readonly steps: number;
  readonly errors: number;
  readonly contextTokens: number | null;
  readonly cost: number | null;
  readonly currency: string | null;
}

export interface RunOutcomeDto {
  readonly runId: string;
  readonly taskId: string;
  readonly fingerprint: string | null;
  readonly endedAt: string;
  readonly ending: RunEnding;
  readonly failure: string | null;
  readonly visit: number;
  readonly usage: RunUsageDto | null;
  readonly checks: CheckVerdict | null;
  readonly firstHumanAction: {
    readonly kind: string;
    readonly at: string;
  } | null;
  readonly passed: { readonly to: string; readonly at: string } | null;
  readonly pullRequestState: TaskPullRequestState | null;
}

export const runOutcomeOf = (
  record: RunRecord,
  taskPullRequests: readonly TaskPullRequest[],
): RunOutcomeDto | null => {
  const end = record.end;
  const ending = record.ending;

  if (!end || !ending) {
    return null;
  }

  const usage = record.usage;

  return {
    runId: record.runId.value,
    taskId: end.location.taskId.value,
    fingerprint: end.fingerprint,
    endedAt: end.endedAt.toISOString(),
    ending,
    failure: end.failure,
    visit: end.visit,
    usage: usage
      ? {
          ms: usage.ms,
          steps: usage.steps,
          errors: usage.errors,
          contextTokens: usage.contextTokens,
          cost: usage.spend?.amount ?? null,
          currency: usage.spend?.currency ?? null,
        }
      : null,
    checks: record.checks,
    firstHumanAction: record.firstHumanAction
      ? {
          kind: record.firstHumanAction.kind,
          at: record.firstHumanAction.at.toISOString(),
        }
      : null,
    passed: record.passed
      ? { to: record.passed.to, at: record.passed.at.toISOString() }
      : null,
    pullRequestState:
      taskPullRequests.find((each) => each.taskId.equals(end.location.taskId))
        ?.state ?? null,
  };
};
