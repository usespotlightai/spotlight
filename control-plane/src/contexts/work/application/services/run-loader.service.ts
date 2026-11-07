import type {
  LeasedRun,
  RunLeasesPort,
} from '@runs/application/ports/run-leases.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { ActsOnItselfOnlyError } from '@work/application/errors/acts-on-itself-only.error';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export interface LoadedRun {
  readonly run: LeasedRun;
  readonly worked: { readonly task: Task; readonly at: StationId } | null;
}

export class RunLoader {
  constructor(
    private readonly leases: RunLeasesPort,
    private readonly dispatches: DispatchRepository,
    private readonly tasks: TaskRepository,
  ) {}

  async actingBeyondItself(
    runId: string,
    runnerId: string,
    what: string,
  ): Promise<LoadedRun> {
    const run = await this.leases.leaseOf(
      RunId.of(runId),
      RunnerId.of(runnerId),
    );

    if (!run.policy.actsBeyondItself) {
      throw new ActsOnItselfOnlyError(what);
    }

    const subject = (await this.dispatches.find(run.runId))?.subject;
    const task =
      subject?.kind === 'task' ? await this.tasks.find(subject.taskId) : null;

    return {
      run,
      worked:
        task && subject?.kind === 'task'
          ? { task, at: subject.stationId }
          : null,
    };
  }
}
