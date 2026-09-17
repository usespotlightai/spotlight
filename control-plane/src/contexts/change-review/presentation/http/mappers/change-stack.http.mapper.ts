import type {
  ChangeStackDto,
  RunChangeStacksDto,
} from '@change-review/application/dto/change-stack.dto';
import {
  ChangeStackResponseDto,
  DiffFileResponseDto,
  DiffHunkResponseDto,
  FileNoteResponseDto,
  RunChangeStacksResponseDto,
  StackCohortResponseDto,
  StackLayerResponseDto,
  StackRangeResponseDto,
} from '@change-review/presentation/http/dto/change-stack.response.dto';

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
    stack.check?.state ?? null,
  );

export const ChangeStackHttpMapper = {
  toResponse(found: RunChangeStacksDto): RunChangeStacksResponseDto {
    return new RunChangeStacksResponseDto(found.stacks.map(toStack));
  },
};
