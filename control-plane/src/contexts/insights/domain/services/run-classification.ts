import type { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import type { RunDisposition } from '@insights/domain/value-objects/run-disposition';
import type { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import type { RunOutcome } from '@insights/domain/value-objects/run-outcome';

export const effectiveEndingOf = (
  end: RunEnd,
  supersededAt: Date | null,
): RunEnding =>
  supersededAt !== null && end.ending !== 'cancelled'
    ? 'superseded'
    : end.ending;

export interface DecidedRun {
  readonly ending: RunEnding | null;
  readonly asked: boolean;
  readonly firstHumanAction: HumanAction | null;
  readonly approvalAnsweredAt: Date | null;
}

export const dispositionOf = (run: DecidedRun): RunDisposition => {
  if (run.firstHumanAction?.accepts) {
    return 'accepted';
  }
  if (run.firstHumanAction?.sendsBack) {
    return 'sent-back';
  }
  if (run.ending === 'failed') {
    return 'failed';
  }
  if (
    run.firstHumanAction?.kind === 'answered' ||
    run.asked ||
    run.approvalAnsweredAt !== null
  ) {
    return 'asked';
  }

  return 'other';
};

export interface ConcludedRun {
  readonly ending: RunEnding;
  readonly firstHumanAction: HumanAction | null;
  readonly passed: boolean;
  readonly merged: boolean;
}

export const outcomeOf = (run: ConcludedRun): RunOutcome => {
  if (run.ending === 'failed') {
    return 'failed';
  }
  if (run.firstHumanAction?.sendsBack) {
    return 'sent-back';
  }
  if (run.firstHumanAction?.accepts) {
    return 'accepted';
  }
  if (run.ending !== 'completed') {
    return 'other';
  }
  if (run.passed || run.firstHumanAction?.kind === 'started') {
    return 'moved-on';
  }

  return run.merged ? 'accepted' : 'other';
};
