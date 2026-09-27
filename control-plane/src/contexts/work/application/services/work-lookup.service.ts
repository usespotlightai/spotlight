import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  JournalStep,
  RunJournal,
} from '@work/application/contracts/run-journal.contract';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type {
  ChangedFile,
  ReasonedStep,
  RunLookup,
  RunPlace,
  RunReasoning,
  SpokenNote,
  TaskLookup,
  TeamLine,
  WorkLookupPort,
} from '@work/application/ports/work-lookup.port';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskNote } from '@work/domain/entities/task-note.entity';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { reasoningIn } from '@work/domain/services/run-reasoning';
import { Concerns } from '@work/domain/value-objects/concerns.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';

const spoken = (note: TaskNote): SpokenNote[] => {
  const by = note.voice.isPerson
    ? 'person'
    : note.voice.isWorld
      ? 'world'
      : null;
  const text = note.body.value.trim();

  return by && text ? [{ position: note.position.value, by, text }] : [];
};

const reasoned = (step: JournalStep, index: number): ReasonedStep[] => {
  const kind = reasoningIn(step);
  return kind ? [{ index, kind, text: step.text }] : [];
};

export class WorkLookup implements WorkLookupPort {
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly journals: RunJournalReaderPort,
  ) {}

  async run(runId: RunId): Promise<RunLookup | null> {
    const run = await this.runs.findById(runId);

    if (!run) {
      return null;
    }

    const line = run.stationId ? await this.lines.holding(run.stationId) : null;
    const station = run.stationId ? line?.stationAt(run.stationId) : null;

    return {
      id: run.id,
      workspaceId: run.workspaceId,
      taskId: run.taskId,
      check: station?.check?.value ?? null,
      setups: run.spec.checkoutSetups,
      placement: run.placement,
      decisions: station?.decisions ?? false,
      memories: station?.memories ?? false,
      ended: run.hasEnded,
      completed: run.hasCompleted,
    };
  }

  async placeOf(runId: RunId): Promise<RunPlace | null> {
    const run = await this.runs.findById(runId);
    const line = run?.stationId
      ? await this.lines.holding(run.stationId)
      : null;
    const station = run?.stationId ? line?.stationAt(run.stationId) : null;

    return run && line && station
      ? {
          teamId: line.teamId,
          lineId: line.id.value,
          lineName: line.name.value,
          stationId: station.id.value,
          stationName: station.name.value,
          repositories: await this.worked(run, line),
        }
      : null;
  }

  async linesOf(teamId: TeamId): Promise<readonly TeamLine[]> {
    return (await this.lines.ofTeam(teamId))
      .filter((line) => !line.isRetired)
      .map((line) => ({
        id: line.id.value,
        name: line.name.value,
        stations: line.stations
          .filter((station) => station.isWorked)
          .map((station) => ({
            id: station.id.value,
            name: station.name.value,
          })),
        repositories: line.repositories.all,
      }));
  }

  async reasoning(runId: RunId): Promise<RunReasoning | null> {
    const run = await this.runs.findById(runId);
    const journal = run ? await this.journals.ofRun(runId) : null;

    if (!run || !journal) {
      return null;
    }

    const worked = run.taskId
      ? await this.journals.ofTask(run.taskId)
      : [journal];
    const changed = (
      await Promise.all(worked.map((each) => this.changedIn(each, run)))
    ).flat();

    return {
      steps: journal.steps.flatMap(reasoned),
      changed: [...new Set(changed)],
    };
  }

  async changedBy(runId: RunId): Promise<readonly ChangedFile[] | null> {
    const run = await this.runs.findById(runId);
    const journal = run ? await this.journals.ofRun(runId) : null;

    if (!run || !journal) {
      return null;
    }

    const line = run.stationId ? await this.lines.holding(run.stationId) : null;
    const repositories = line ? await this.worked(run, line) : [];
    const changed = new Map<string, ChangedFile>();

    for (const step of journal.steps) {
      const within = step.change?.path
        ? run.spec.workspacePathOf(step.change.path)
        : null;
      const [folder, ...rest] = within?.split('/') ?? [];
      const repository = repositories.find((each) => each.name === folder);

      if (repository && rest.length > 0) {
        const path = rest.join('/');
        changed.set(`${repository.value}:${path}`, { repository, path });
      }
    }

    return [...changed.values()];
  }

  async spokenOn(taskId: TaskId): Promise<readonly SpokenNote[] | null> {
    const task = await this.tasks.find(taskId);

    return task ? task.notes.flatMap(spoken) : null;
  }

  private async worked(run: Run, line: Line): Promise<readonly Repository[]> {
    const task = run.taskId ? await this.tasks.find(run.taskId) : null;
    const reviewed = task?.reviewed;

    return reviewed ? [reviewed] : line.repositories.all;
  }

  private async changedIn(journal: RunJournal, asked: Run): Promise<string[]> {
    const run =
      journal.runId === asked.id.value
        ? asked
        : await this.runs.findById(RunId.of(journal.runId));

    if (!run) {
      return [];
    }

    return journal.steps.flatMap((step) => {
      const path = step.change?.path;
      const within = path ? run.spec.workspacePathOf(path) : null;
      return within ? [within] : [];
    });
  }

  async wasWorkedBy(runId: RunId, runner: RunnerId): Promise<boolean> {
    return (await this.runs.findById(runId))?.wasWorkedBy(runner) ?? false;
  }

  async task(taskId: TaskId): Promise<TaskLookup | null> {
    const task = await this.tasks.find(taskId);

    return task ? this.lookup(task) : null;
  }

  async taskWithPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<TaskLookup | null> {
    const task =
      (await this.wearing(workspaceId, Mark.pullRequest(pullRequest))) ??
      (await this.wearing(workspaceId, Mark.review(pullRequest)));

    return task ? this.lookup(task) : null;
  }

  private async wearing(
    workspaceId: WorkspaceId,
    mark: Mark,
  ): Promise<Task | null> {
    const concerns = Concerns.of({ marks: [mark] });

    return concerns ? this.tasks.holding(workspaceId, concerns) : null;
  }

  private async lookup(task: Task): Promise<TaskLookup> {
    const line = await this.lines.holding(task.stationId);

    return {
      id: task.id,
      workspaceId: task.workspaceId,
      teamId: line?.teamId ?? null,
      pullRequest: task.pullRequest,
      reviewing: task.reviewing,
      fromOutside: task.fromOutside,
      currentRunId: task.currentRunId,
    };
  }
}
