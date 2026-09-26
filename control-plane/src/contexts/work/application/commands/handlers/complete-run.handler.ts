import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { CompleteRunCommand } from '@work/application/commands/runner.commands';
import type { HookedTasksPort } from '@work/application/ports/hooked-tasks.port';
import type { LifecycleHooksPort } from '@work/application/ports/lifecycle-hooks.port';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { Declaration } from '@work/domain/value-objects/declaration.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';

export class CompleteRunHandler
  implements CommandHandlerPort<CompleteRunCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly transaction: TransactionPort,
    private readonly hookedTasks: HookedTasksPort,
    private readonly hooks: LifecycleHooksPort,
  ) {}

  async execute(command: CompleteRunCommand): Promise<void> {
    try {
      const runId = RunId.of(command.runId);
      const runnerId = RunnerId.of(command.runnerId);
      const outcome = command.stopped
        ? RunOutcome.stopped(command.exitCode)
        : RunOutcome.of({
            exitCode: command.exitCode,
            failed: command.failed,
            message: command.message,
          });
      const declared =
        command.declared && !outcome.failed && !outcome.stopped
          ? await this.handingOver(
              runId,
              runnerId,
              Declaration.of(command.declared),
            )
          : command.declared
            ? Declaration.of(command.declared)
            : null;

      await this.transaction.run(async () => {
        const found = await this.runs.findById(runId);
        if (!found) {
          throw new UnknownRunError(`there is no run ${command.runId}`);
        }

        await this.runs.save(
          found.complete(
            runnerId,
            outcome,
            HandoverReport.of({
              declared,
              session: command.sessionId
                ? HarnessSession.of(command.sessionId)
                : null,
            }),
          ),
        );
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async handingOver(
    runId: RunId,
    runnerId: RunnerId,
    declared: Declaration,
  ): Promise<Declaration> {
    const run = await this.runs.findById(runId);

    if (!run?.taskId || run.hasEnded || !run.wasWorkedBy(runnerId)) {
      return declared;
    }

    const hooked = await this.hookedTasks.of(run.taskId.value, run.id.value);

    if (!hooked) {
      return declared;
    }

    const verdict = await this.hooks.before(hooked, {
      on: 'handover.giving',
      to: declared.next === '' ? null : declared.next,
      note: declared.note,
    });

    return verdict.kind === 'refused'
      ? declared.heldBack(verdict.reason)
      : declared;
  }
}
