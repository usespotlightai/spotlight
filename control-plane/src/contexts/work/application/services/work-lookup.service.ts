import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  JournalStep,
  RunChanges,
  RunJournal,
} from '@work/application/contracts/run-journal.contract';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type {
  ChangedFile,
  HeldRunLookup,
  ReasonedStep,
  RunLookup,
  RunPlace,
  RunReasoning,
  RunSite,
  SpokenNote,
  TaskLookup,
  TeamLine,
  WorkLookupPort,
} from '@work/application/ports/work-lookup.port';
import { referencesUnder } from '@work/application/services/journal-references';
import { distinctFiles } from '@work/application/services/touched-files';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskNote } from '@work/domain/entities/task-note.entity';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { reasoningIn } from '@work/domain/services/run-reasoning';
import { repositoriesWorkedOn } from '@work/domain/services/task-checkouts';
import {
  filesChangedIn,
  workspacePathsIn,
} from '@work/domain/services/workspace-path';
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

const changesIn = (journal: RunJournal, run: Run): RunChanges => ({
  runId: journal.runId,
  checkouts: run.spec.checkoutFolders,
  paths: journal.steps.flatMap((step) =>
    step.change?.path ? [step.change.path] : [],
  ),
});

const reasoned = (step: JournalStep, index: number): ReasonedStep[] => {
  const reasoning = reasoningIn(step);
  return reasoning ? [{ index, ...reasoning }] : [];
};

export class WorkLookup implements WorkLookupPort {
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly chats: ChatRepository,
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
      check: run.spec.check,
      setups: run.spec.checkoutSetups,
      placement: run.placement,
      decisions: station?.decisions ?? false,
      memories: station?.memories ?? false,
      briefedWith: run.briefedWith.value,
      ended: run.hasEnded,
      completed: run.hasCompleted,
      replay: run.isReplay,
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
      ? await this.journals.changesOfTask(run.taskId)
      : [changesIn(journal, run)];

    return {
      steps: journal.steps.flatMap(reasoned),
      changed: [...new Set(worked.flatMap(workspacePathsIn))],
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

    return distinctFiles(filesChangedIn(changesIn(journal, run), repositories));
  }

  async spokenOn(taskId: TaskId): Promise<readonly SpokenNote[] | null> {
    const task = await this.tasks.find(taskId);

    return task ? task.notes.flatMap(spoken) : null;
  }

  private async worked(run: Run, line: Line): Promise<readonly Repository[]> {
    const task = run.taskId ? await this.tasks.find(run.taskId) : null;

    return repositoriesWorkedOn(task, line);
  }

  async wasWorkedBy(runId: RunId, runner: RunnerId): Promise<boolean> {
    return (await this.runs.findById(runId))?.wasWorkedBy(runner) ?? false;
  }

  async heldBy(runId: RunId, runner: RunnerId): Promise<HeldRunLookup | null> {
    const run = await this.runs.findById(runId);

    if (!run?.isHeldBy(runner)) {
      return null;
    }

    const site = await this.siteOf(run);

    return (
      site && {
        id: run.id,
        workspaceId: run.workspaceId,
        taskId: run.taskId,
        replaysFrom: await this.replaysFrom(run),
        ...site,
      }
    );
  }

  private async replaysFrom(run: Run): Promise<Date | null> {
    if (!run.replayOf) {
      return null;
    }

    const started = (await this.runs.findById(run.replayOf))?.startedFrom;

    if (!started) {
      throw new InconsistentStateError(
        'run',
        `replays a run that never said where it started (${run.id.value})`,
      );
    }

    return started.at;
  }

  async siteOfRun(runId: RunId): Promise<RunSite | null> {
    const run = await this.runs.findById(runId);
    return run ? this.siteOf(run) : null;
  }

  async referencedUnder(
    runId: RunId,
    folder: string,
    file: RegExp,
  ): Promise<readonly string[] | null> {
    const journal = await this.journals.ofRun(runId);

    return journal ? referencesUnder(journal, folder, file) : null;
  }

  private async siteOf(run: Run): Promise<RunSite | null> {
    if (run.chatId) {
      const chat = await this.chats.find(run.chatId);
      return (
        chat && {
          teamId: chat.teamId,
          lineId: null,
          stationId: null,
          repositories: chat.repositories,
        }
      );
    }

    const line = run.stationId ? await this.lines.holding(run.stationId) : null;
    const replayedFor = run.replayedFor;

    if (replayedFor) {
      return {
        teamId: replayedFor,
        lineId: line?.teamId.equals(replayedFor) ? line.id.value : null,
        stationId: line ? (run.stationId?.value ?? null) : null,
        repositories: run.replayedRepositories,
      };
    }

    return (
      line &&
      run.stationId && {
        teamId: line.teamId,
        lineId: line.id.value,
        stationId: run.stationId.value,
        repositories: await this.worked(run, line),
      }
    );
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
