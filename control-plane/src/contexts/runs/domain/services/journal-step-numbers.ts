import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const STEPS_PER_ATTEMPT = 1_000_000;

export interface AttemptSteps<Step> {
  readonly attempt: number;
  readonly steps: readonly Step[];
}

export interface NumberedStep<Step> {
  readonly index: number;
  readonly step: Step;
}

export const stepNumber = (attempt: number, position: number): number => {
  if (position >= STEPS_PER_ATTEMPT) {
    throw new InconsistentStateError(
      'run journal',
      `keeps at most ${STEPS_PER_ATTEMPT} steps in each attempt`,
    );
  }

  return (attempt - 1) * STEPS_PER_ATTEMPT + position;
};

const numbered = <Step>({
  attempt,
  steps,
}: AttemptSteps<Step>): NumberedStep<Step>[] =>
  steps.map((step, position) => ({
    index: stepNumber(attempt, position),
    step,
  }));

export const stepsThrough = <Step>(
  attempts: readonly AttemptSteps<Step>[],
  through: number | null,
): NumberedStep<Step>[] | null => {
  const taken = attempts
    .filter((each) => through === null || each.attempt <= through)
    .sort((a, b) => a.attempt - b.attempt);

  return taken.length > 0 ? taken.flatMap(numbered) : null;
};
