import type { ReadDeliveryCommand } from '@integrations/application/commands/read-delivery.command';
import {
  CAUSE_HEADER,
  type HookFiringHistoryPort,
} from '@integrations/application/ports/hook-firing-history.port';
import type { WebhookHeaders } from '@integrations/application/ports/webhook-provider.port';
import type { ProviderForDelivery } from '@integrations/application/services/provider-for-delivery.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CausationPort } from '@shared-kernel/application/ports/causation.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { HappeningReactionsPort } from '@work/application/ports/happening-reactions.port';

const causeIn = (headers: WebhookHeaders): string | null => {
  const named = headers[CAUSE_HEADER];
  const cause = Array.isArray(named) ? named[0] : named;

  return cause?.trim() || null;
};

export class ReadDeliveryHandler
  implements CommandHandlerPort<ReadDeliveryCommand, void>
{
  constructor(
    private readonly providers: ProviderForDelivery,
    private readonly reactions: HappeningReactionsPort,
    private readonly history: HookFiringHistoryPort,
    private readonly causation: CausationPort,
  ) {}

  async execute(command: ReadDeliveryCommand): Promise<void> {
    try {
      const stored = command.delivered;
      const provider = await this.providers.find({
        integration: stored.integration,
        workspaceId: stored.workspaceId,
        teamId: stored.teamId,
        teamKey: stored.teamKey,
      });

      if (!provider) {
        return;
      }

      const delivered = {
        headers: stored.headers,
        body: stored.body,
        raw: null,
      };

      const news = (await provider.read(delivered)).filter(
        (each) => !each.ourOwn,
      );

      if (news.length === 0) {
        return;
      }

      const workspaceId = await provider.routes(delivered);

      if (!workspaceId) {
        return;
      }

      const cause = causeIn(stored.headers);
      const fired = cause
        ? await this.history.chainOf(workspaceId.value, cause)
        : null;

      await this.causation.runWith(
        this.deliveryChain(fired, stored.integration),
        () =>
          this.reactions.react(
            workspaceId,
            stored.teamId ? TeamId.of(stored.teamId) : null,
            news,
            `delivery:${stored.integration}:${stored.teamId}:${stored.id}`,
          ),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private deliveryChain(
    fired: CausalChain | null,
    integration: string,
  ): CausalChain {
    return fired
      ? fired.append({
          kind: 'delivery',
          key: `delivery:${integration}`,
          description: `a delivery from ${integration}`,
        })
      : CausalChain.none();
  }
}
