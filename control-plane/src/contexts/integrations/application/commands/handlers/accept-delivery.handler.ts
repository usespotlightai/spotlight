import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { AcceptDeliveryCommand } from '@integrations/application/commands/accept-delivery.command';
import type { DeliveryReceipt } from '@integrations/application/dto/delivery-receipt.dto';
import type {
  Delivered,
  WebhookProviderPort,
} from '@integrations/application/ports/webhook-provider.port';
import type { ProviderForDelivery } from '@integrations/application/services/provider-for-delivery.service';
import {
  type DeliveryAddressee,
  InboundDelivery,
} from '@integrations/domain/aggregates/inbound-delivery.aggregate';
import type { InboundDeliveryRepository } from '@integrations/domain/repositories/inbound-delivery.repository';
import { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import { InboundDeliveryId } from '@integrations/domain/value-objects/inbound-delivery-id.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

type Refusal = 'unknown-team' | 'unknown-integration' | 'bad-signature';

const REFUSED: DeliveryReceipt = { kind: 'refused' };

export class AcceptDeliveryHandler
  implements CommandHandlerPort<AcceptDeliveryCommand, DeliveryReceipt>
{
  constructor(
    private readonly providers: ProviderForDelivery,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly deliveries: InboundDeliveryRepository,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(command: AcceptDeliveryCommand): Promise<DeliveryReceipt> {
    try {
      const to = await this.addresseeOf(command);

      if (to === undefined) {
        return this.refused(command, null, 'unknown-team');
      }

      const integration = IntegrationKey.maybe(command.integration);
      const provider =
        integration && (await this.providers.find({ integration, to }));

      if (!provider) {
        return this.refused(command, to, 'unknown-integration');
      }

      if (!(await this.trusts(provider, command.delivered))) {
        return this.refused(command, to, 'bad-signature');
      }

      const answer = provider.answer?.(command.delivered) ?? null;

      if (answer !== null) {
        return { kind: 'answered', body: answer };
      }

      await this.deliveries.add(
        InboundDelivery.receive(
          {
            integration: IntegrationKey.of(provider.key),
            to,
            id: InboundDeliveryId.of(provider.delivery(command.delivered)),
            headers: command.delivered.headers,
            body: command.delivered.body,
            causeFiringId: command.causeFiringId?.trim()
              ? HookFiringId.of(command.causeFiringId.trim())
              : null,
          },
          this.clock.now(),
        ),
      );

      return { kind: 'accepted' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async addresseeOf(
    command: AcceptDeliveryCommand,
  ): Promise<DeliveryAddressee | null | undefined> {
    const address = command.addressedTo;

    if (!address) {
      return null;
    }

    const team = await this.workspaces.identifyTeam(
      address.slug,
      address.teamKey,
    );

    return team
      ? {
          workspaceId: team.workspaceId,
          teamId: team.teamId,
          teamKey: address.teamKey,
        }
      : undefined;
  }

  private async trusts(
    provider: WebhookProviderPort,
    delivered: Delivered,
  ): Promise<boolean> {
    try {
      return await provider.verifies(delivered);
    } catch (error) {
      this.logger.warn(
        { integration: provider.key, error: (error as Error).message },
        'A webhook delivery could not be verified',
      );

      return false;
    }
  }

  private refused(
    command: AcceptDeliveryCommand,
    to: DeliveryAddressee | null,
    reason: Refusal,
  ): DeliveryReceipt {
    this.logger.warn(
      {
        workspaceId: to?.workspaceId.value,
        teamId: to?.teamId.value,
        integration: command.integration,
        reason,
      },
      'Refused a webhook delivery',
    );

    return REFUSED;
  }
}
