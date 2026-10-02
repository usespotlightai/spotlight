import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { JournalStep } from '@work/application/contracts/run-journal.contract';
import type { BriefedTasksPort } from '@work/application/ports/briefed-tasks.port';
import type { ContentDigestPort } from '@work/application/ports/content-digest.port';
import type {
  EvidencedHunk,
  EvidencedRun,
  EvidencedStep,
  RunEvidencePort,
  StationJudgeSettings,
} from '@work/application/ports/run-evidence.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { hunksOf } from '@work/domain/services/change-hunks';
import { workspacePath } from '@work/domain/services/workspace-path';
import { StationId } from '@work/domain/value-objects/station-id.vo';

const MOST_TEXT = 4_000;

interface AskedOfRun {
  readonly taskId: string;
  readonly title: string;
  readonly description: string | null;
}

const MOST_TOLD = 2_000;

const clipped = (text: string, most: number): string =>
  text.length > most ? `${text.slice(0, most)} …` : text;

const clippedOrNone = (text: string | null): string | null =>
  text === null ? null : clipped(text, MOST_TOLD);

const evidenced = (step: JournalStep, index: number): EvidencedStep => ({
  index,
  kind: step.kind,
  tool: step.tool,
  text: clipped(step.text, MOST_TEXT),
  given: clippedOrNone(step.given),
  returned: clippedOrNone(step.returned),
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
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly journals: RunJournalReaderPort,
    private readonly briefed: BriefedTasksPort,
    private readonly digest: ContentDigestPort,
  ) {}

  async holds(runId: string): Promise<boolean> {
    const run = await this.runs.findById(RunId.of(runId));

    return Boolean(run?.taskId && (await this.tasks.find(run.taskId)));
  }

  async of(runId: string): Promise<EvidencedRun | null> {
    const run = await this.runs.findById(RunId.of(runId));
    const asked = run ? await this.askedOf(run) : null;
    const attempts = run ? await this.journals.attemptsOfRun(run.id) : [];

    if (!run || !asked || attempts.length === 0) {
      return null;
    }

    const steps = attempts.flatMap((each) => each.steps);

    return {
      runId: run.id.value,
      ...asked,
      steps: steps.map(evidenced),
      hunks: hunksIn(steps, run.spec.checkoutFolders),
    };
  }

  private async askedOf(run: Run): Promise<AskedOfRun | null> {
    if (run.replayOf) {
      const [original, briefed] = await Promise.all([
        this.runs.findById(run.replayOf),
        this.briefed.of(run.replayOf),
      ]);

      return original?.taskId && briefed
        ? {
            taskId: original.taskId.value,
            title: briefed.title,
            description: briefed.description,
          }
        : null;
    }

    const task = run.taskId ? await this.tasks.find(run.taskId) : null;

    return (
      task && {
        taskId: task.id.value,
        title: task.title.value,
        description: task.description?.value ?? null,
      }
    );
  }

  async judgeAt(stationId: string): Promise<StationJudgeSettings | null> {
    const at = StationId.of(stationId);
    const line = await this.lines.holding(at);
    const judge = line?.stationAt(at)?.judge ?? null;

    return line && judge
      ? {
          teamId: line.teamId.value,
          lineId: line.id.value,
          rubric: judge.rubric,
          rubricVersion: this.digest.sha256(judge.rubric),
          sample: judge.sample,
          trust: judge.trust,
        }
      : null;
  }
}
