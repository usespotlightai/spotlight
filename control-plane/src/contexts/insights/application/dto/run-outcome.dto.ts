import type { CheckVerdict } from '@insights/domain/value-objects/check-verdict';
import type { LabelSource } from '@insights/domain/value-objects/label-source';
import type { RunHumanAction } from '@insights/domain/value-objects/person-action.vo';
import type { PullRequestState } from '@insights/domain/value-objects/pull-request-state';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { RunResolution } from '@insights/domain/value-objects/run-resolution';

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
  readonly resolution: RunResolution;
  readonly labelFrom: LabelSource | null;
  readonly failure: string | null;
  readonly runNumber: number;
  readonly usage: RunUsageDto | null;
  readonly checks: CheckVerdict | null;
  readonly humanAction: {
    readonly kind: RunHumanAction;
    readonly at: string;
  } | null;
  readonly passed: { readonly to: string; readonly at: string } | null;
  readonly pullRequestState: PullRequestState | null;
}

export const runOutcomeOf = (record: RunFact): RunOutcomeDto => {
  const end = record.end;
  const usage = record.usage;

  return {
    runId: record.runId.value,
    taskId: end.location.taskId.value,
    fingerprint: end.fingerprint,
    endedAt: end.endedAt.toISOString(),
    ending: record.ending,
    resolution: record.resolution,
    labelFrom: record.humanLabel?.from ?? null,
    failure: end.failure,
    runNumber: end.runNumber,
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
    humanAction: record.actions.humanAction
      ? {
          kind: record.actions.humanAction.kind,
          at: record.actions.humanAction.at.toISOString(),
        }
      : null,
    passed: record.passed
      ? { to: record.passed.to.value, at: record.passed.at.toISOString() }
      : null,
    pullRequestState: record.pullRequest?.state ?? null,
  };
};
