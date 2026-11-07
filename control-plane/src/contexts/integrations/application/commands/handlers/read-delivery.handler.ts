import type { ReadDeliveryCommand } from '@integrations/application/commands/read-delivery.command';
import type { CausationPort } from '@integrations/application/ports/causation.port';
import type { DeliveryReactionsPort } from '@integrations/application/ports/delivery-reactions.port';
import type { DeliveryReaderPort } from '@integrations/application/ports/delivery-reader.port';
import type { HookFiringHistoryPort } from '@integrations/application/ports/hook-firing-history.port';
import type { ProviderForDelivery } from '@integrations/application/services/provider-for-delivery.service';
import { CauseLinks } from '@integrations/domain/services/cause-links';
import { CausalChain } from '@integrations/domain/value-objects/causal-chain.vo';
import type { DeliveryFailure } from '@integrations/domain/value-objects/delivery-failure.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export class ReadDeliveryHandler
  implements CommandHandlerPort<ReadDeliveryCommand, DeliveryFailure | null>
{
  constructor(
    private readonly providers: ProviderForDelivery,
    private readonly reader: DeliveryReaderPort,
    private readonly reactions: DeliveryReactionsPort,
    private readonly history: HookFiringHistoryPort,
    private readonly causation: CausationPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(command: ReadDeliveryCommand): Promise<DeliveryFailure | null> {
    try {
      return await this.read(command);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async read(
    command: ReadDeliveryCommand,
  ): Promise<DeliveryFailure | null> {
    {
      const stored = command.delivered;
      const provider = await this.providers.find({
        integration: stored.integration,
        to: stored.to,
      });

      if (!provider) {
        this.ignored(stored, 'no-provider');
        return null;
      }

      const delivered = {
        headers: stored.headers,
        body: stored.body,
        raw: null,
      };

      const unreceived = await this.reader.receive(provider, delivered);

      if (unreceived) {
        return unreceived;
      }

      const reading = await this.reader.read(provider, delivered);

      if (reading.kind === 'failed') {
        return reading.failure;
      }

      const news = reading.happenings.filter((each) => !each.ourOwn);

      if (news.length === 0) {
        this.ignored(stored, 'nothing-new');
        return null;
      }

      const workspaceId = await provider.routes(delivered);

      if (!workspaceId) {
        this.ignored(stored, 'no-workspace');
        return null;
      }

      const cause = stored.causeFiringId;
      const fired = cause
        ? await this.history.chainOf(workspaceId, cause)
        : null;

      return this.causation.runWith(
        this.deliveryChain(fired, stored.integration),
        () =>
          this.reactions.react(
            workspaceId,
            stored.to?.teamId ?? null,
            news,
            stored.receivedAs,
          ),
      );
    }
  }

  private ignored(
    stored: ReadDeliveryCommand['delivered'],
    reason: 'no-provider' | 'nothing-new' | 'no-workspace',
  ): void {
    this.logger.info(
      {
        deliveryId: stored.id.value,
        integration: stored.integration.value,
        workspaceId: stored.to?.workspaceId.value,
        teamId: stored.to?.teamId.value,
        reason,
      },
      'Ignored a delivery',
    );
  }

  private deliveryChain(
    fired: CausalChain | null,
    integration: IntegrationKey,
  ): CausalChain {
    return fired
      ? fired.append(CauseLinks.delivery(integration))
      : CausalChain.none();
  }
}
