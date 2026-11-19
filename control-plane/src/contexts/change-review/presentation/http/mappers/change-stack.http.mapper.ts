import type {
  ChangeStackDto,
  CheckedStepDto,
  DiffFileDto,
  PublicChangeStackDto,
  PublicChangeStacksDto,
  QuestionAnswerDto,
  RemovedLayerDto,
  StackLayerDto,
  ChangeStacksDto,
  StackCheckDto,
} from '@change-review/application/dto/change-stack.dto';
import { checkReasonText } from '@change-review/application/rendering/check-reason.text';
import {
  ChangeStackResponseDto,
  CheckedStepResponseDto,
  DiffFileResponseDto,
  DiffHunkResponseDto,
  FileNoteResponseDto,
  LayerQuestionResponseDto,
  LayerRevisionResponseDto,
  PushOriginResponseDto,
  QuestionAnswerResponseDto,
  RemovedLayerResponseDto,
  ChangeStacksResponseDto,
  StackCheckResponseDto,
  StackCohortResponseDto,
  StackHunkResponseDto,
  StackLayerResponseDto,
} from '@change-review/presentation/http/dto/change-stack.response.dto';
import {
  PublicChangeStackResponseDto,
  PublicChangeStacksResponseDto,
  PublicLayerQuestionResponseDto,
  PublicStackCohortResponseDto,
  PublicStackLayerResponseDto,
} from '@change-review/presentation/http/dto/public-change-stack.response.dto';
import { changeStackFailureText } from '@change-review/presentation/http/mappers/change-stack-failure.text';

const stepOf = (step: CheckedStepDto): CheckedStepResponseDto =>
  new CheckedStepResponseDto(
    step.step,
    step.passed,
    step.output,
    step.durationMs,
  );

const answerOf = (answer: QuestionAnswerDto): QuestionAnswerResponseDto =>
  new QuestionAnswerResponseDto(
    answer.questionId,
    answer.reply,
    answer.verdict,
    answer.feedback,
    answer.expected,
    answer.outdated,
  );

const checkOf = (check: StackCheckDto): StackCheckResponseDto =>
  new StackCheckResponseDto(
    check.command,
    check.status,
    checkReasonText(check),
    check.whole && stepOf(check.whole),
    check.layers.map(stepOf),
  );

const filesOf = (files: readonly DiffFileDto[]): DiffFileResponseDto[] =>
  files.map(
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
  );

const removedOf = (
  removed: readonly RemovedLayerDto[],
): RemovedLayerResponseDto[] =>
  removed.map(
    (each) =>
      new RemovedLayerResponseDto(each.previous, each.cohort, each.title),
  );

const layerPartsOf = (layer: Omit<StackLayerDto, 'questions'>) => ({
  hunks: layer.hunks.map((entry) => new StackHunkResponseDto(entry.hunk)),
  notes: layer.notes.map(
    (each) => new FileNoteResponseDto(each.path, each.note),
  ),
  revision:
    layer.revision &&
    new LayerRevisionResponseDto(
      layer.revision.status,
      layer.revision.previous,
    ),
});

const toStack = (stack: ChangeStackDto): ChangeStackResponseDto =>
  new ChangeStackResponseDto(
    stack.id,
    stack.repository,
    stack.state,
    changeStackFailureText(stack.failure),
    filesOf(stack.files),
    stack.cohorts.map(
      (cohort) =>
        new StackCohortResponseDto(
          cohort.id,
          cohort.kind,
          cohort.title,
          cohort.intent,
          cohort.layers.map((layer) => {
            const { hunks, notes, revision } = layerPartsOf(layer);

            return new StackLayerResponseDto(
              layer.id,
              layer.title,
              layer.summary,
              hunks,
              notes,
              layer.questions.map(
                (each) =>
                  new LayerQuestionResponseDto(
                    each.id,
                    each.question,
                    each.hunks,
                    each.answered && answerOf(each.answered),
                  ),
              ),
              revision,
            );
          }),
        ),
    ),
    removedOf(stack.removed),
    stack.check && checkOf(stack.check),
    stack.runId,
    stack.push &&
      new PushOriginResponseDto(stack.push.head, stack.push.pushedBy),
  );

const toPublicStack = (
  stack: PublicChangeStackDto,
): PublicChangeStackResponseDto =>
  new PublicChangeStackResponseDto(
    stack.id,
    stack.repository,
    stack.state,
    filesOf(stack.files),
    stack.cohorts.map(
      (cohort) =>
        new PublicStackCohortResponseDto(
          cohort.id,
          cohort.kind,
          cohort.title,
          cohort.intent,
          cohort.layers.map((layer) => {
            const { hunks, notes, revision } = layerPartsOf(layer);

            return new PublicStackLayerResponseDto(
              layer.id,
              layer.title,
              layer.summary,
              hunks,
              notes,
              layer.questions.map(
                (each) =>
                  new PublicLayerQuestionResponseDto(
                    each.id,
                    each.question,
                    each.hunks,
                  ),
              ),
              revision,
            );
          }),
        ),
    ),
    removedOf(stack.removed),
  );

export const ChangeStackHttpMapper = {
  toAnswer: answerOf,

  toPublicResponse(
    found: PublicChangeStacksDto,
  ): PublicChangeStacksResponseDto {
    return new PublicChangeStacksResponseDto(found.stacks.map(toPublicStack));
  },

  toResponse(found: ChangeStacksDto): ChangeStacksResponseDto {
    return new ChangeStacksResponseDto(found.stacks.map(toStack));
  },
};
