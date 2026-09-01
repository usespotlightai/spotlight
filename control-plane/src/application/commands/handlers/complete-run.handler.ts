import type { CompleteRunCommand } from '@application/commands/runner.commands';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { RunOutcomes } from '@application/services/run-outcomes';
import { Run } from '@domain/aggregates/run.aggregate';
import { RunCompleted } from '@domain/events/run-completed.event';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { RunRepository } from '@domain/repositories/run.repository';
import { Declaration } from '@domain/value-objects/declaration.vo';
import { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';

const announce = async (ended: Run, to: RunOutcomes): Promise<void> => {
  for (const raised of ended.happened) {
    if (raised instanceof RunCompleted) {
      await to.onRunCompleted(raised);
    } else {
      await to.onRunAbandoned(raised);
    }
  }
};

export class CompleteRunHandler
  implements CommandHandlerPort<CompleteRunCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly transaction: TransactionPort,
    private readonly handover: RunOutcomes,
  ) {}

  async execute(command: CompleteRunCommand): Promise<void> {
    try {
      await this.transaction.run(async () => {
        const found = await this.runs.findById(RunId.of(command.runId));
        if (!found) {
          throw new UnknownRunError(`there is no run ${command.runId}`);
        }

        const ended = found.complete(
          RunnerId.of(command.runnerId),
          {
            exitCode: command.exitCode,
            failed: command.failed,
            message: command.message,
          },
          {
            declared: command.declared
              ? Declaration.of(command.declared)
              : null,
            session: command.sessionId
              ? HarnessSession.of(command.sessionId)
              : null,
          },
        );

        await this.runs.save(ended);
        await announce(ended, this.handover);
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
