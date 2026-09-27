import type {
  ChangedFile,
  ReasonedStep,
  RememberedRun,
  RememberedTask,
  SpokenNote,
  TeamLine,
  WorkedPlace,
  WorkPort,
} from '@memory/application/ports/work.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
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
        taskId: run.taskId,
        completed: run.completed,
        memories: run.memories,
      }
    );
  }

  async placeOf(runId: RunId): Promise<WorkedPlace | null> {
    const place = await this.work.placeOf(runId);

    return (
      place && {
        teamId: place.teamId,
        lineId: place.lineId,
        lineName: place.lineName,
        stationId: place.stationId,
        stationName: place.stationName,
        repositories: place.repositories,
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
