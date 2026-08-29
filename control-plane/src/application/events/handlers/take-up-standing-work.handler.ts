import type { StandingWorkPort } from '@application/ports/standing-work.port';
import type { TaskDispatchPort } from '@application/ports/task-dispatch.port';
import type { Station } from '@domain/entities/station.entity';
import type { TaskRepository } from '@domain/repositories/task.repository';

export class TakeUpStandingWork implements StandingWorkPort {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly dispatch: TaskDispatchPort,
  ) {}

  async takeUp({
    station,
    stations,
  }: {
    station: Station;
    stations: readonly Station[];
  }): Promise<void> {
    if (!station.harness) {
      return;
    }

    for (const standing of await this.tasks.standingAt(station.id)) {
      if (!standing.idle) {
        continue;
      }

      const runId = await this.dispatch.dispatch({
        task: standing,
        station,
        stations,
      });

      if (runId) {
        await this.tasks.save(standing.handedTo(runId));
      }
    }
  }
}
