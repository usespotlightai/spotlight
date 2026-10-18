import type { CheckedStepDto } from '@change-review/application/dto/change-stack-check.dto';
import type { CheckedStep } from '@change-review/domain/value-objects/stack-check.vo';
import {
  type StepId,
  WHOLE_STEP,
} from '@change-review/domain/value-objects/stack-check.vo';
import { LayerId } from '@change-review/domain/value-objects/stack-ids';

const stepFrom = (raw: string): StepId =>
  raw === WHOLE_STEP ? WHOLE_STEP : LayerId.of(raw);

export const checkedStepsFrom = (
  steps: readonly CheckedStepDto[],
): CheckedStep[] =>
  steps.map((step) => ({
    step: stepFrom(step.step),
    passed: step.passed,
    output: step.output,
    durationMs: step.durationMs,
  }));
