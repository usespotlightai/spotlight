import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { CompleteRunCommand } from '@work/application/commands/runner.commands';
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
  ) {}

  async execute(command: CompleteRunCommand): Promise<void> {
    try {
      const _ended = await this.transaction.run(async () => {
        const found = await this.runs.findById(RunId.of(command.runId));
        if (!found) {
          throw new UnknownRunError(`there is no run ${command.runId}`);
        }

        const done = found.complete(
          RunnerId.of(command.runnerId),
          command.stopped
            ? RunOutcome.stopped(command.exitCode)
            : RunOutcome.of({
                exitCode: command.exitCode,
                failed: command.failed,
                message: command.message,
              }),
          HandoverReport.of({
            declared: command.declared
              ? Declaration.of(command.declared)
              : null,
            session: command.sessionId
              ? HarnessSession.of(command.sessionId)
              : null,
          }),
        );

        await this.runs.save(done);

        return done;
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
