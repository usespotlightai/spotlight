import { RefreshIntegrationSpecCommand } from '@integrations/application/commands/refresh-integration-spec.command';
import type { ListedServersPort } from '@integrations/application/ports/listed-servers.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export class RelistServers {
  constructor(
    private readonly servers: ListedServersPort,
    private readonly refreshingSpec: CommandHandlerPort<
      RefreshIntegrationSpecCommand,
      void
    >,
    private readonly clock: ClockPort,
    private readonly log: LoggerPort,
    private readonly everyMs: number,
  ) {}

  async processDue(): Promise<void> {
    const now = this.clock.now();
    const due = new Date(now.getTime() - this.everyMs);

    for (const server of await this.servers.claimListedBefore(due, now)) {
      try {
        await this.refreshingSpec.execute(
          new RefreshIntegrationSpecCommand(
            server.teamId.value,
            server.integration.value,
          ),
        );
      } catch (error) {
        this.log.error(
          { err: error, integration: server.integration.value },
          'Listing the tools of an MCP server again',
        );
      }
    }
  }
}
