import type {
  ChangeStackDto,
  CheckedLayerDto,
  RunChangeStacksDto,
} from '@change-review/application/dto/change-stack.dto';
import {
  ChangeStackResponseDto,
  CheckedLayerResponseDto,
  DiffFileResponseDto,
  DiffHunkResponseDto,
  LayerDependencyResponseDto,
  RunChangeStacksResponseDto,
  StackCheckResponseDto,
  StackCohortResponseDto,
  StackLayerResponseDto,
  StackRangeResponseDto,
} from '@change-review/presentation/http/dto/change-stack.response.dto';

const toChecked = (step: CheckedLayerDto): CheckedLayerResponseDto =>
  new CheckedLayerResponseDto(step.step, step.passed, step.output, step.tookMs);

const toStack = (stack: ChangeStackDto): ChangeStackResponseDto =>
  new ChangeStackResponseDto(
    stack.id,
    stack.repository,
    stack.state,
    stack.failure,
    stack.draftedAt,
    stack.settledAt,
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
                layer.dependsOn.map(
                  (dependency) =>
                    new LayerDependencyResponseDto(
                      dependency.layer,
                      dependency.because,
                    ),
                ),
                layer.ranges.map(
                  (range) =>
                    new StackRangeResponseDto(range.hunk, range.summary),
                ),
              ),
          ),
        ),
    ),
    stack.check &&
      new StackCheckResponseDto(
        stack.check.command,
        stack.check.state,
        stack.check.reason,
        stack.check.whole && toChecked(stack.check.whole),
        stack.check.layers.map(toChecked),
      ),
  );

export const ChangeStackHttpMapper = {
  toResponse(found: RunChangeStacksDto): RunChangeStacksResponseDto {
    return new RunChangeStacksResponseDto(found.stacks.map(toStack));
  },
};
