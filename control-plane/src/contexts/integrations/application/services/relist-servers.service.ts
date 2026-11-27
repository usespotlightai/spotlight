import { RefreshIntegrationSpecCommand } from '@integrations/application/commands/refresh-integration-spec.command';
import type {
  ListedServer,
  ListedServersPort,
} from '@integrations/application/ports/listed-servers.port';
import { IntegrationDefinitionVersionConflictError } from '@integrations/domain/exceptions/integration-definition-version-conflict.error';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class RelistServers {
  constructor(
    private readonly servers: ListedServersPort,
    private readonly definitions: IntegrationDefinitionRepository,
    private readonly refreshingSpec: CommandHandlerPort<
      RefreshIntegrationSpecCommand,
      void
    >,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly log: LoggerPort,
    private readonly everyMs: number,
  ) {}

  async processDue(): Promise<void> {
    const now = this.clock.now();
    const due = new Date(now.getTime() - this.everyMs);

    for (const server of await this.servers.listedBefore(due)) {
      try {
        if (await this.claimed(server, now, due)) {
          await this.refreshingSpec.execute(
            new RefreshIntegrationSpecCommand(
              server.teamId.value,
              server.integration.value,
            ),
          );
        }
      } catch (error) {
        this.log.error(
          { err: error, integration: server.integration.value },
          'Listing the tools of an MCP server again',
        );
      }
    }
  }

  private async claimed(
    server: ListedServer,
    now: Date,
    due: Date,
  ): Promise<boolean> {
    const definition = await this.definitions.of(
      server.teamId,
      server.integration,
    );

    if (!definition?.relistDue(due)) {
      return false;
    }

    try {
      await this.transaction.inTransaction(() =>
        this.definitions.save(definition.relistClaimed(now, due)),
      );
    } catch (error) {
      if (error instanceof IntegrationDefinitionVersionConflictError) {
        return false;
      }

      throw error;
    }

    return true;
  }
}
