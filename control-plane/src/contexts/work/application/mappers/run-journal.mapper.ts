import type {
  JournalledRun,
  JournalStep,
  RunJournal,
  RunSpan,
} from '@runs/application/contracts/run-journal.contract';
import type {
  JournalledRunDto,
  JournalStepDto,
  RunJournalDto,
  RunSpanDto,
} from '@work/application/dto/run-journal.dto';
import { RunReadingMapper } from '@work/application/mappers/run-reading.mapper';

const isoOrNull = (at: Date | null): string | null => at?.toISOString() ?? null;

export const stepToDto = (step: JournalStep): JournalStepDto => ({
  kind: RunReadingMapper.stepKind(step.kind),
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
  input: step.input,
  output: step.output,
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
  attributes: span.attributes.map((attribute) => ({
    name: attribute.name,
    value: attribute.value,
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
        startedAt: isoOrNull(journal.marks.startedAt),
        readyAt: isoOrNull(journal.marks.readyAt),
        firstAgentUpdateAt: isoOrNull(journal.marks.firstAgentUpdateAt),
        lastAgentUpdateAt: isoOrNull(journal.marks.lastAgentUpdateAt),
        agentStoppedAt: isoOrNull(journal.marks.agentStoppedAt),
        endedAt: isoOrNull(journal.marks.endedAt),
      },
      spent: journal.spent && {
        used: journal.spent.used,
        size: journal.spent.size,
        cost: journal.spent.cost?.amount ?? null,
        currency: journal.spent.cost?.currency ?? null,
      },
    };
  },

  runToDto(run: JournalledRun): JournalledRunDto {
    return {
      runId: run.runId,
      createdAt: run.createdAt.toISOString(),
      stepCount: run.stepCount,
      messageCount: run.messageCount,
    };
  },
};
