import type {
  JournalStepDto,
  RunJournalDto,
  RunSpanDto,
} from '@work/application/dto/run-journal.dto';
import {
  JournalStepResponseDto,
  RunJournalResponseDto,
  RunMarksResponseDto,
  RunSpanResponseDto,
  RunSpentResponseDto,
  SpanAttributeResponseDto,
  StepChangeResponseDto,
  StepLocationResponseDto,
} from '@work/presentation/http/dto/run-journal.response.dto';

export const stepToResponse = (step: JournalStepDto): JournalStepResponseDto =>
  new JournalStepResponseDto(
    step.kind,
    step.text,
    step.status,
    step.tool,
    step.detail,
    step.ms,
    step.startedAt,
    step.locations.map(
      (where) => new StepLocationResponseDto(where.path, where.line),
    ),
    step.given,
    step.returned,
    step.change
      ? new StepChangeResponseDto(
          step.change.path,
          step.change.before,
          step.change.after,
        )
      : null,
  );

export const spanToResponse = (span: RunSpanDto): RunSpanResponseDto =>
  new RunSpanResponseDto(
    span.id,
    span.parentId,
    span.name,
    span.startedAt,
    span.ms,
    span.failed,
    span.attributes.map(
      (attribute) =>
        new SpanAttributeResponseDto(attribute.name, attribute.value),
    ),
  );

export const RunJournalHttpMapper = {
  toResponse(journal: RunJournalDto): RunJournalResponseDto {
    return new RunJournalResponseDto(
      journal.runId,
      journal.attempt,
      journal.steps.map(stepToResponse),
      journal.spans.map(spanToResponse),
      journal.ms,
      new RunMarksResponseDto(
        journal.marks.startedAt,
        journal.marks.readyAt,
        journal.marks.firstAgentUpdateAt,
        journal.marks.lastAgentUpdateAt,
        journal.marks.endedAt,
      ),
      journal.spent
        ? new RunSpentResponseDto(
            journal.spent.used,
            journal.spent.size,
            journal.spent.cost,
            journal.spent.currency,
          )
        : null,
    );
  },
};
