import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { JournalStep } from '@work/application/contracts/run-journal.contract';
import type {
  EvidencedHunk,
  EvidencedRun,
  EvidencedStep,
  RunEvidencePort,
} from '@work/application/ports/run-evidence.port';
import type {
  RunFacts,
  RunFactsPort,
} from '@work/application/ports/run-facts.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { hunksOf } from '@work/domain/services/change-hunks';
import { workspacePath } from '@work/domain/services/workspace-path';

const MAX_TEXT = 4_000;

interface TaskOfRun {
  readonly taskId: string;
  readonly title: string;
  readonly description: string | null;
}

const MAX_TOOL_IO_CHARS = 2_000;

const clipped = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)} …` : text;

const clippedOrNone = (text: string | null): string | null =>
  text === null ? null : clipped(text, MAX_TOOL_IO_CHARS);

const evidenced = (step: JournalStep, index: number): EvidencedStep => ({
  index,
  kind: step.kind,
  tool: step.tool,
  text: clipped(step.text, MAX_TEXT),
  input: clippedOrNone(step.input),
  output: clippedOrNone(step.output),
});

const hunksIn = (
  steps: readonly JournalStep[],
  checkouts: readonly string[],
): EvidencedHunk[] => {
  const order: string[] = [];
  const first = new Map<string, string>();
  const last = new Map<string, string>();

  for (const step of steps) {
    const change = step.change;

    if (!change?.path) {
      continue;
    }
    if (!first.has(change.path)) {
      first.set(change.path, change.before);
      order.push(change.path);
    }
    last.set(change.path, change.after);
  }

  return order.flatMap((path) =>
    hunksOf(
      workspacePath(path, checkouts) ?? path,
      first.get(path) ?? '',
      last.get(path) ?? '',
    ),
  );
};

export class RunEvidences implements RunEvidencePort {
  constructor(
    private readonly runs: RunFactsPort,
    private readonly tasks: TaskRepository,
    private readonly journals: RunJournalReaderPort,
    private readonly dispatches: DispatchRepository,
  ) {}

  async hasTask(runId: string): Promise<boolean> {
    const subject = (await this.dispatches.find(RunId.of(runId)))?.subject;

    return Boolean(
      subject?.kind === 'task' && (await this.tasks.find(subject.taskId)),
    );
  }

  async of(runId: string): Promise<EvidencedRun | null> {
    const run = await this.found(RunId.of(runId));
    const task = run ? await this.taskOf(run) : null;
    const attempts = run ? await this.journals.attemptsOfRun(run.runId) : [];

    if (!run || !task || attempts.length === 0) {
      return null;
    }

    const steps = attempts.flatMap((each) => each.steps);

    return {
      runId: run.runId.value,
      ...task,
      steps: steps.map(evidenced),
      hunks: hunksIn(steps, run.checkouts),
    };
  }

  private async found(runId: RunId): Promise<RunFacts | null> {
    const [run] = await this.runs.of([runId]);

    return run ?? null;
  }

  private async taskOf(run: RunFacts): Promise<TaskOfRun | null> {
    const subject = (await this.dispatches.find(run.runId))?.subject;

    if (subject?.kind === 'trial') {
      const original = await this.dispatches.find(subject.basedOn);
      const briefed = original?.briefedTask;

      return original?.subject.kind === 'task' && briefed
        ? {
            taskId: original.subject.taskId.value,
            title: briefed.title,
            description: briefed.description,
          }
        : null;
    }

    const task =
      subject?.kind === 'task' ? await this.tasks.find(subject.taskId) : null;

    return (
      task && {
        taskId: task.id.value,
        title: task.title.value,
        description: task.description?.value ?? null,
      }
    );
  }
}
