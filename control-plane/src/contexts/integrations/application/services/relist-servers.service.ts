import { RereadIntegrationSourceCommand } from '@integrations/application/commands/reread-integration-source.command';
import type { ListedServersPort } from '@integrations/application/ports/listed-servers.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export class RelistServers {
  constructor(
    private readonly servers: ListedServersPort,
    private readonly rereading: CommandHandlerPort<
      RereadIntegrationSourceCommand,
      void
    >,
    private readonly clock: ClockPort,
    private readonly log: LoggerPort,
    private readonly everyMs: number,
  ) {}

  async workOff(): Promise<void> {
    const now = this.clock.now();
    const due = new Date(now.getTime() - this.everyMs);

    for (const server of await this.servers.claimListedBefore(due, now)) {
      try {
        await this.rereading.execute(
          new RereadIntegrationSourceCommand(
            server.teamId.value,
            server.source.value,
          ),
        );
      } catch (error) {
        this.log.error(
          { err: error, source: server.source.value },
          'Listing the tools of an MCP server again',
        );
      }
    }
  }
}
