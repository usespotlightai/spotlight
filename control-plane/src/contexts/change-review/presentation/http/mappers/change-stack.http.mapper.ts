import type {
  ChangeStackDto,
  CheckedStepDto,
  RunChangeStacksDto,
  StackCheckDto,
} from '@change-review/application/dto/change-stack.dto';
import {
  ChangeStackResponseDto,
  CheckedStepResponseDto,
  DiffFileResponseDto,
  DiffHunkResponseDto,
  FileNoteResponseDto,
  RunChangeStacksResponseDto,
  StackCheckResponseDto,
  StackCohortResponseDto,
  StackLayerResponseDto,
  StackRangeResponseDto,
} from '@change-review/presentation/http/dto/change-stack.response.dto';

const stepOf = (step: CheckedStepDto): CheckedStepResponseDto =>
  new CheckedStepResponseDto(step.step, step.passed, step.output, step.tookMs);

const checkOf = (check: StackCheckDto): StackCheckResponseDto =>
  new StackCheckResponseDto(
    check.command,
    check.state,
    check.reason,
    check.whole && stepOf(check.whole),
    check.layers.map(stepOf),
  );

const toStack = (stack: ChangeStackDto): ChangeStackResponseDto =>
  new ChangeStackResponseDto(
    stack.id,
    stack.repository,
    stack.state,
    stack.failure,
    stack.files.map(
      (file) =>
        new DiffFileResponseDto(
          file.path,
          file.previousPath,
          file.status,
          file.binary,
          file.hunks.map(
            (hunk) =>
              new DiffHunkResponseDto(
                hunk.id,
                hunk.oldStart,
                hunk.oldLines,
                hunk.newStart,
                hunk.newLines,
                hunk.patch,
              ),
          ),
        ),
    ),
    stack.cohorts.map(
      (cohort) =>
        new StackCohortResponseDto(
          cohort.id,
          cohort.kind,
          cohort.title,
          cohort.intent,
          cohort.layers.map(
            (layer) =>
              new StackLayerResponseDto(
                layer.id,
                layer.title,
                layer.summary,
                layer.ranges.map(
                  (range) => new StackRangeResponseDto(range.hunk),
                ),
                layer.notes.map(
                  (each) => new FileNoteResponseDto(each.path, each.note),
                ),
              ),
          ),
        ),
    ),
    stack.check && checkOf(stack.check),
  );

export const ChangeStackHttpMapper = {
  toResponse(found: RunChangeStacksDto): RunChangeStacksResponseDto {
    return new RunChangeStacksResponseDto(found.stacks.map(toStack));
  },
};
