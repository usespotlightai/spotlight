import type { StandingWorkPort } from '@application/ports/standing-work.port';
import type { TaskDispatchPort } from '@application/ports/task-dispatch.port';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { StationId } from '@domain/value-objects/station-id.vo';

export class TakeUpStandingWork implements StandingWorkPort {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly dispatch: TaskDispatchPort,
  ) {}

  async takeUp({
    line,
    stationId,
  }: {
    line: AssemblyLine;
    stationId: StationId;
  }): Promise<void> {
    if (!line.stationAt(stationId)?.harness) {
      return;
    }

    for (const standing of await this.tasks.standingAt(stationId)) {
      if (!standing.idle) {
        continue;
      }

      const runId = await this.dispatch.dispatch({ task: standing, line });

      if (runId) {
        await this.tasks.save(standing.handedTo(runId));
      }
    }
  }
}
