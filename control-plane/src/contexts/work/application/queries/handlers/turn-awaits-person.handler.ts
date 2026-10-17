import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { LifecycleHooksPort } from '@work/application/ports/lifecycle-hooks.port';
import type { TurnAwaitsPersonQuery } from '@work/application/queries/turn-awaits-person.query';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { turnWaits } from '@work/domain/services/turn-end';
import { Handover } from '@work/domain/value-objects/handover.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';

export class TurnAwaitsPersonHandler
  implements QueryHandlerPort<TurnAwaitsPersonQuery, boolean>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly hooks: LifecycleHooksPort,
  ) {}

  async execute(query: TurnAwaitsPersonQuery): Promise<boolean> {
    try {
      const runner = RunnerId.of(query.runnerId);
      const run = await this.runs.findById(RunId.of(query.runId));

      if (!run?.isLeasedBy(runner)) {
        throw new UnknownRunError(
          `Runner ${query.runnerId} has no lease on run ${query.runId}.`,
        );
      }

      const task = run.taskId ? await this.tasks.find(run.taskId) : null;
      const line = task ? await this.lines.findByStation(task.stationId) : null;

      return turnWaits({
        run,
        by: runner,
        task,
        line,
        mayBeSentToReview: line
          ? await this.hooks.listens(line.teamId.value, 'handover.submitting')
          : false,
        outcome: query.stopped
          ? RunOutcome.stopped(query.exitCode)
          : RunOutcome.of({
              exitCode: query.exitCode,
              failed: query.failed,
            }),
        handover: query.handover ? Handover.of(query.handover) : null,
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
