import type { RevokeRunnerCommand } from '@application/commands/runner.commands';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { RunnerRevocationPort } from '@application/ports/runner-revocation.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { RunnerRepository } from '@domain/repositories/runner.repository';
import { RunnerId } from '@domain/value-objects/runner-id.vo';

export class RevokeRunnerHandler
  implements CommandHandlerPort<RevokeRunnerCommand, void>
{
  constructor(
    private readonly runners: RunnerRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly revocation: RunnerRevocationPort,
  ) {}

  async execute(command: RevokeRunnerCommand): Promise<void> {
    try {
      const id = RunnerId.of(command.runnerId);

      const revoking = await this.runners.find(id);
      if (!revoking) {
        throw new UnknownRunError(`runner ${command.runnerId} is not enrolled`);
      }

      const revoked = revoking.revoke(this.clock.now());

      await this.transaction.run(async () => {
        await this.runners.save(revoked);

        for (const event of revoked.happened) {
          await this.revocation.onRunnerRevoked(event);
        }
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

/**
 * How long a claim is held open before answering empty. The runner polls in a
 * tight loop, so holding the request here is what keeps it off the database.
 */
const _POLL_TIMEOUT_MS = 10_000;
const _POLL_INTERVAL_MS = 500;
