import type { ReadDeliveryCommand } from '@integrations/application/commands/read-delivery.command';
import type { SourceForDelivery } from '@integrations/application/services/source-for-delivery.service';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { HappeningReactionsPort } from '@work/application/ports/happening-reactions.port';

export class ReadDeliveryHandler
  implements CommandHandlerPort<ReadDeliveryCommand, void>
{
  constructor(
    private readonly sources: SourceForDelivery,
    private readonly reactions: HappeningReactionsPort,
  ) {}

  async execute(command: ReadDeliveryCommand): Promise<void> {
    try {
      const stored = command.delivered;
      const source = await this.sources.find({
        source: stored.source,
        workspaceId: stored.workspaceId,
        teamId: stored.teamId,
        teamKey: stored.teamKey,
      });

      if (!source) {
        return;
      }

      const delivered = {
        headers: stored.headers,
        body: stored.body,
        raw: null,
      };

      const news = (await source.read(delivered)).filter(
        (each) => !each.ourOwn,
      );

      if (news.length === 0) {
        return;
      }

      const workspaceId = await source.routes(delivered);

      if (!workspaceId) {
        return;
      }

      await this.reactions.react(
        workspaceId,
        stored.teamId ? TeamId.of(stored.teamId) : null,
        news,
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
