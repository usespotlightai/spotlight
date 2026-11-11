import type {
  ChangeStackDto,
  CheckedStepDto,
  QuestionAnswerDto,
  RunChangeStacksDto,
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
  QuestionAnswerResponseDto,
  RemovedLayerResponseDto,
  RunChangeStacksResponseDto,
  StackCheckResponseDto,
  StackCohortResponseDto,
  StackHunkResponseDto,
  StackLayerResponseDto,
} from '@change-review/presentation/http/dto/change-stack.response.dto';
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

const toStack = (stack: ChangeStackDto): ChangeStackResponseDto =>
  new ChangeStackResponseDto(
    stack.id,
    stack.repository,
    stack.state,
    changeStackFailureText(stack.failure),
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
                layer.hunks.map(
                  (entry) => new StackHunkResponseDto(entry.hunk),
                ),
                layer.notes.map(
                  (each) => new FileNoteResponseDto(each.path, each.note),
                ),
                layer.questions.map(
                  (each) =>
                    new LayerQuestionResponseDto(
                      each.id,
                      each.question,
                      each.hunks,
                      each.answered && answerOf(each.answered),
                    ),
                ),
                layer.revision &&
                  new LayerRevisionResponseDto(
                    layer.revision.status,
                    layer.revision.previous,
                  ),
              ),
          ),
        ),
    ),
    stack.removed.map(
      (each) =>
        new RemovedLayerResponseDto(each.previous, each.cohort, each.title),
    ),
    stack.check && checkOf(stack.check),
  );

export const ChangeStackHttpMapper = {
  toAnswer: answerOf,

  toResponse(found: RunChangeStacksDto): RunChangeStacksResponseDto {
    return new RunChangeStacksResponseDto(found.stacks.map(toStack));
  },
};
