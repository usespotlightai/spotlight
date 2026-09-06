import type { CompleteRunCommand } from '@application/commands/runner.commands';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { RunRepository } from '@domain/repositories/run.repository';
import { Declaration } from '@domain/value-objects/declaration.vo';
import { HandoverReport } from '@domain/value-objects/handover-report.vo';
import { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunOutcome } from '@domain/value-objects/run-outcome.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';

export class CompleteRunHandler
  implements CommandHandlerPort<CompleteRunCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly transaction: TransactionPort,
    private readonly events: DomainEventDispatcher,
  ) {}

  async execute(command: CompleteRunCommand): Promise<void> {
    try {
      const ended = await this.transaction.run(async () => {
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

      await this.events.dispatch(ended.pullEvents());
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
