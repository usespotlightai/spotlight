import type { WebhookHeaders } from '@integrations/application/ports/webhook-provider.port';
import type { DeliveryAddressee } from '@integrations/domain/aggregates/inbound-delivery.aggregate';
import type { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import type { InboundDeliveryId } from '@integrations/domain/value-objects/inbound-delivery-id.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';

export interface ReceivedDelivery {
  readonly integration: IntegrationKey;
  readonly to: DeliveryAddressee | null;
  readonly id: InboundDeliveryId;
  readonly receivedAs: string;
  readonly headers: WebhookHeaders;
  readonly body: unknown;
  readonly causeFiringId: HookFiringId | null;
}
