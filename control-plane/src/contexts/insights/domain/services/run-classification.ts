import {
  HumanLabel,
  type LabelEvidence,
} from '@insights/domain/value-objects/human-label.vo';
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

export interface ClassifiedRun extends LabelEvidence {
  readonly asked: boolean;
  readonly answered: boolean;
  readonly approvalAnswered: boolean;
  readonly passed: boolean;
}

const movesOn = (run: ClassifiedRun): boolean =>
  run.passed || run.decidingAction?.kind === 'started';

export const resolutionOf = (run: ClassifiedRun): RunResolution => {
  const label = HumanLabel.of(run);

  if (label && !label.passes) {
    return 'sent-back';
  }
  if (label && !(label.mergedOnly && movesOn(run))) {
    return 'accepted';
  }
  if (run.ending === 'failed') {
    return 'failed';
  }
  if (run.ending !== 'completed') {
    return 'other';
  }

  return movesOn(run) ? 'moved-on' : 'other';
};

export const dispositionOf = (run: ClassifiedRun): RunDisposition => {
  const label = HumanLabel.of(run);

  if (label) {
    return label.passes ? 'accepted' : 'sent-back';
  }
  if (run.ending === 'failed') {
    return 'failed';
  }

  return run.answered || run.asked || run.approvalAnswered ? 'asked' : 'other';
};
