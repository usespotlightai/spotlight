import type { DiffFileDto } from '@change-review/application/dto/change-stack.dto';
import type { CheckedStepDto } from '@change-review/application/dto/change-stack-check.dto';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import type { CheckedStep } from '@change-review/domain/value-objects/stack-check.vo';
import {
  type StepId,
  WHOLE_STEP,
} from '@change-review/domain/value-objects/stack-check.vo';
import { HunkId, LayerId } from '@change-review/domain/value-objects/stack-ids';

export const stepFrom = (raw: string): StepId =>
  raw === WHOLE_STEP ? WHOLE_STEP : LayerId.of(raw);

export const checkedStepsFrom = (
  steps: readonly CheckedStepDto[],
): CheckedStep[] =>
  steps.map((step) => ({
    step: stepFrom(step.step),
    passed: step.passed,
    output: step.output,
    tookMs: step.tookMs,
  }));

export const diffFrom = (files: readonly DiffFileDto[]): Diff =>
  Diff.of(
    files.map((file) => ({
      path: file.path,
      previousPath: file.previousPath,
      status: file.status,
      binary: file.binary,
      hunks: file.hunks.map((hunk) => ({
        id: HunkId.of(hunk.id),
        oldStart: hunk.oldStart,
        oldLines: hunk.oldLines,
        newStart: hunk.newStart,
        newLines: hunk.newLines,
        patch: hunk.patch,
      })),
    })),
  );
