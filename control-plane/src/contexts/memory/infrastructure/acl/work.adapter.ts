import type {
  LeasedRun,
  NamedStationContext,
  ReasonedStep,
  RememberedRun,
  RememberedTask,
  TaskNote,
  WorkPort,
} from '@memory/application/ports/work.port';
import { MEMORY_FOLDER } from '@memory/domain/services/memory-folder';
import type { RunContext } from '@memory/domain/value-objects/run-context';
import type { AgentTurn } from '@shared-kernel/domain/value-objects/agent-turn.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkRunLookupPort } from '@work/application/ports/work-run-lookup.port';
import type { WorkTaskLookupPort } from '@work/application/ports/work-task-lookup.port';

const MEMORY_FILES = { folder: MEMORY_FOLDER, extension: '.md' };

export class Work implements WorkPort {
  constructor(
    private readonly work: WorkRunLookupPort,
    private readonly tasks: WorkTaskLookupPort,
  ) {}

  async run(runId: RunId): Promise<RememberedRun | null> {
    const run = await this.work.run(runId);

    return (
      run && {
        id: run.id,
        workspaceId: run.workspaceId,
        taskId: run.taskId,
        attempt: run.attempt,
        orderedAt: run.orderedAt,
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
        asOf: leased.asOf,
        isolated: leased.isolated,
        trial: leased.trial,
        lineId: leased.lineId === null ? null : LineId.of(leased.lineId),
        stationId:
          leased.stationId === null ? null : StationId.of(leased.stationId),
        repositories: leased.repositories,
      }
    );
  }

  async contextOfRun(runId: RunId): Promise<RunContext | null> {
    const runContext = await this.work.contextOfRun(runId);

    return (
      runContext && {
        teamId: runContext.teamId,
        lineId:
          runContext.lineId === null ? null : LineId.of(runContext.lineId),
        stationId:
          runContext.stationId === null
            ? null
            : StationId.of(runContext.stationId),
        repositories: runContext.repositories,
      }
    );
  }

  memoryFilesRead(runId: RunId): Promise<readonly string[] | null> {
    return this.work.filesReadUnder(runId, MEMORY_FILES);
  }

  async stationContextOf(runId: RunId): Promise<NamedStationContext | null> {
    const runContext = await this.work.locationOf(runId);

    return (
      runContext && {
        teamId: runContext.teamId,
        lineId: LineId.of(runContext.lineId),
        lineName: runContext.lineName,
        stationId: StationId.of(runContext.stationId),
        stationName: runContext.stationName,
        repositories: runContext.repositories,
      }
    );
  }

  async task(taskId: TaskId): Promise<RememberedTask | null> {
    const task = await this.tasks.task(taskId);

    return (
      task && {
        id: task.id,
        workspaceId: task.workspaceId,
        teamId: task.teamId,
        fromOutside: task.fromOutside,
      }
    );
  }

  reasoning(runId: RunId): Promise<readonly ReasonedStep[] | null> {
    return this.reasonedSteps(runId, null);
  }

  reasoningThrough(turn: AgentTurn): Promise<readonly ReasonedStep[] | null> {
    return this.reasonedSteps(turn.runId, turn.attempt);
  }

  async notesOf(taskId: TaskId): Promise<readonly TaskNote[] | null> {
    const notes = await this.tasks.notesOf(taskId);

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

  private async reasonedSteps(
    runId: RunId,
    throughAttempt: number | null,
  ): Promise<readonly ReasonedStep[] | null> {
    const reasoning = await this.work.reasoning(runId, throughAttempt);

    return (
      reasoning?.steps.map((each) => ({
        index: each.index,
        kind: each.kind,
        text: each.text,
      })) ?? null
    );
  }
}
