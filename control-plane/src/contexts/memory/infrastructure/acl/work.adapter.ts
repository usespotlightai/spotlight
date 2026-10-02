import type {
  ChangedFile,
  HeldRun,
  NamedStationSite,
  ReasonedStep,
  RememberedRun,
  RememberedTask,
  SpokenNote,
  TeamLine,
  WorkPort,
} from '@memory/application/ports/work.port';
import type { RunSite } from '@memory/domain/value-objects/run-site';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
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
        cut: run.briefedWith.cut.map((each) => each.id),
      }
    );
  }

  async heldBy(runId: RunId, runner: RunnerId): Promise<HeldRun | null> {
    const held = await this.work.heldBy(runId, runner);

    return (
      held && {
        id: held.id,
        workspaceId: held.workspaceId,
        teamId: held.teamId,
        taskId: held.taskId,
        replaysFrom: held.replaysFrom,
        isSearch: held.isSearch,
        lineId: held.lineId,
        stationId: held.stationId,
        repositories: held.repositories,
      }
    );
  }

  async siteOfRun(runId: RunId): Promise<RunSite | null> {
    const site = await this.work.siteOfRun(runId);

    return (
      site && {
        teamId: site.teamId,
        lineId: site.lineId,
        stationId: site.stationId,
        repositories: site.repositories,
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

  async stationSiteOf(runId: RunId): Promise<NamedStationSite | null> {
    const site = await this.work.placeOf(runId);

    return (
      site && {
        teamId: site.teamId,
        lineId: site.lineId,
        lineName: site.lineName,
        stationId: site.stationId,
        stationName: site.stationName,
        repositories: site.repositories,
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

  async spokenOn(taskId: TaskId): Promise<readonly SpokenNote[] | null> {
    const spoken = await this.work.spokenOn(taskId);

    return (
      spoken?.map((each) => ({
        position: each.position,
        by: each.by,
        text: each.text,
      })) ?? null
    );
  }
}
