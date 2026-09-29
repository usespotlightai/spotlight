import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { LifecycleHooksPort } from '@work/application/ports/lifecycle-hooks.port';
import type { TurnAsksAPersonQuery } from '@work/application/queries/turn-asks-a-person.query';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { turnWaits } from '@work/domain/services/turn-end';
import { Declaration } from '@work/domain/value-objects/declaration.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';

export class TurnAsksAPersonHandler
  implements QueryHandlerPort<TurnAsksAPersonQuery, boolean>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly hooks: LifecycleHooksPort,
  ) {}

  async execute(query: TurnAsksAPersonQuery): Promise<boolean> {
    try {
      const runner = RunnerId.of(query.runnerId);
      const run = await this.runs.findById(RunId.of(query.runId));

      if (!run?.isHeldBy(runner)) {
        throw new UnknownRunError(
          `runner ${query.runnerId} holds no run ${query.runId}`,
        );
      }

      const task = run.taskId ? await this.tasks.find(run.taskId) : null;
      const line = task ? await this.lines.holding(task.stationId) : null;

      return turnWaits({
        run,
        by: runner,
        task,
        line,
        mayBeWithheld: line
          ? await this.hooks.listens(line.teamId.value, 'handover.giving')
          : false,
        outcome: query.stopped
          ? RunOutcome.stopped(query.exitCode)
          : RunOutcome.of({
              exitCode: query.exitCode,
              failed: query.failed,
            }),
        declared: query.declared ? Declaration.of(query.declared) : null,
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
