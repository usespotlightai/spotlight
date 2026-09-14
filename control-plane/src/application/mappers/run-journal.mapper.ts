import type {
  JournalStep,
  RunJournal,
  RunSpan,
} from '@application/contracts/run-journal.contract';
import type {
  JournalStepDto,
  RunJournalDto,
  RunSpanDto,
} from '@application/dto/run-journal.dto';

const spoken = (at: Date | null): string | null => at?.toISOString() ?? null;

export const stepToDto = (step: JournalStep): JournalStepDto => ({
  kind: step.kind,
  text: step.text,
  status: step.status,
  tool: step.tool,
  detail: step.detail,
  ms: step.ms,
  startedAt: step.startedAt.toISOString(),
  locations: step.locations.map((where) => ({
    path: where.path,
    line: where.line,
  })),
  given: step.given,
  returned: step.returned,
  change: step.change && {
    path: step.change.path,
    before: step.change.before,
    after: step.change.after,
  },
});

export const spanToDto = (span: RunSpan): RunSpanDto => ({
  id: span.id,
  parentId: span.parentId,
  name: span.name,
  startedAt: span.startedAt.toISOString(),
  ms: span.ms,
  failed: span.failed,
  attributes: span.attributes.map((held) => ({
    name: held.name,
    value: held.value,
  })),
});

export const RunJournalMapper = {
  toDto(journal: RunJournal): RunJournalDto {
    return {
      runId: journal.runId,
      attempt: journal.attempt,
      steps: journal.steps.map(stepToDto),
      spans: journal.spans.map(spanToDto),
      ms: journal.ms,
      marks: {
        startedAt: spoken(journal.marks.startedAt),
        readyAt: spoken(journal.marks.readyAt),
        spokeFrom: spoken(journal.marks.spokeFrom),
        spokeTo: spoken(journal.marks.spokeTo),
        endedAt: spoken(journal.marks.endedAt),
      },
      spent: journal.spent && {
        used: journal.spent.used,
        size: journal.spent.size,
        cost: journal.spent.cost?.amount ?? null,
        currency: journal.spent.cost?.currency ?? null,
      },
    };
  },
};
