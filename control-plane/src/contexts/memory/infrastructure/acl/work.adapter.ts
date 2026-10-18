import type {
  ChangedFile,
  LeasedRun,
  NamedStationContext,
  ReasonedStep,
  RememberedRun,
  RememberedTask,
  TaskNote,
  TeamLine,
  WorkPort,
} from '@memory/application/ports/work.port';
import type { RunContext } from '@memory/domain/value-objects/run-context';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkLookupPort } from '@work/application/ports/work-lookup.port';

export class Work implements WorkPort {
  constructor(private readonly work: WorkLookupPort) {}

  async run(runId: RunId): Promise<RememberedRun | null> {
    const run = await this.work.run(runId);

    return (
      run && {
        id: run.id,
        workspaceId: run.workspaceId,
        taskId: run.taskId,
        completed: run.completed,
        memories: run.memories,
        briefed: run.briefedWith.briefed.map((each) => each.id),
        omitted: run.briefedWith.omitted.map((each) => each.id),
      }
    );
  }

  async leasedBy(runId: RunId, runner: RunnerId): Promise<LeasedRun | null> {
    const leased = await this.work.leasedBy(runId, runner);

    return (
      leased && {
        id: leased.id,
        workspaceId: leased.workspaceId,
        teamId: leased.teamId,
        taskId: leased.taskId,
        replaysFrom: leased.replaysFrom,
        isSearch: leased.isSearch,
        lineId: leased.lineId,
        stationId: leased.stationId,
        repositories: leased.repositories,
      }
    );
  }

  async contextOfRun(runId: RunId): Promise<RunContext | null> {
    const runContext = await this.work.contextOfRun(runId);

    return (
      runContext && {
        teamId: runContext.teamId,
        lineId: runContext.lineId,
        stationId: runContext.stationId,
        repositories: runContext.repositories,
      }
    );
  }

  referencedUnder(
    runId: RunId,
    folder: string,
    file: RegExp,
  ): Promise<readonly string[] | null> {
    return this.work.referencedUnder(runId, folder, file);
  }

  async stationContextOf(runId: RunId): Promise<NamedStationContext | null> {
    const runContext = await this.work.locationOf(runId);

    return (
      runContext && {
        teamId: runContext.teamId,
        lineId: runContext.lineId,
        lineName: runContext.lineName,
        stationId: runContext.stationId,
        stationName: runContext.stationName,
        repositories: runContext.repositories,
      }
    );
  }

  async linesOf(teamId: TeamId): Promise<readonly TeamLine[]> {
    return (await this.work.linesOf(teamId)).map((line) => ({
      id: line.id,
      name: line.name,
      stations: line.stations.map((station) => ({
        id: station.id,
        name: station.name,
      })),
      repositories: line.repositories,
    }));
  }

  async task(taskId: TaskId): Promise<RememberedTask | null> {
    const task = await this.work.task(taskId);

    return (
      task && {
        id: task.id,
        workspaceId: task.workspaceId,
        teamId: task.teamId,
        fromOutside: task.fromOutside,
      }
    );
  }

  async reasoning(runId: RunId): Promise<readonly ReasonedStep[] | null> {
    const reasoning = await this.work.reasoning(runId);

    return (
      reasoning?.steps.map((each) => ({
        index: each.index,
        kind: each.kind,
        text: each.text,
      })) ?? null
    );
  }

  async changedBy(runId: RunId): Promise<readonly ChangedFile[] | null> {
    const changed = await this.work.changedBy(runId);

    return (
      changed?.map((each) => ({
        repository: each.repository,
        path: each.path,
      })) ?? null
    );
  }

  async notesOf(taskId: TaskId): Promise<readonly TaskNote[] | null> {
    const notes = await this.work.notesOf(taskId);

    return (
      notes?.map((each) => ({
        position: each.position,
        by: each.by,
        author: each.author ? UserId.of(each.author) : null,
        text: each.text,
      })) ?? null
    );
  }

  async harnessOf(runId: RunId): Promise<string | null> {
    return (await this.work.run(runId))?.harness ?? null;
  }
}
