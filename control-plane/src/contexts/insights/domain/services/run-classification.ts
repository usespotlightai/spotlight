import type { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import type { RunDisposition } from '@insights/domain/value-objects/run-disposition';
import type { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import type { RunResolution } from '@insights/domain/value-objects/run-resolution';

export const effectiveEndingOf = (
  end: RunEnd,
  supersededAt: Date | null,
): RunEnding =>
  supersededAt !== null && end.ending !== 'cancelled'
    ? 'superseded'
    : end.ending;

export interface ClassifiedRun {
  readonly ending: RunEnding;
  readonly asked: boolean;
  readonly firstHumanAction: HumanAction | null;
  readonly approvalAnsweredAt: Date | null;
  readonly passed: boolean;
  readonly taskMerged: boolean;
  readonly followed: boolean;
}

export const resolutionOf = (run: ClassifiedRun): RunResolution => {
  if (run.firstHumanAction?.rejectsRun) {
    return 'sent-back';
  }
  if (run.firstHumanAction?.accepts) {
    return 'accepted';
  }
  if (run.ending === 'failed') {
    return 'failed';
  }
  if (run.ending !== 'completed') {
    return 'other';
  }
  if (run.passed || run.firstHumanAction?.kind === 'started') {
    return 'moved-on';
  }

  return run.taskMerged && !run.followed ? 'accepted' : 'other';
};

export type AnsweredRun = Omit<
  ClassifiedRun,
  'passed' | 'taskMerged' | 'followed'
>;

export const dispositionOf = (run: AnsweredRun): RunDisposition => {
  if (run.firstHumanAction?.accepts) {
    return 'accepted';
  }
  if (run.firstHumanAction?.rejectsRun) {
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
