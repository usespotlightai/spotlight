import type { WebhookHeaders } from '@integrations/application/ports/webhook-provider.port';
import type { DeliveryAddressee } from '@integrations/domain/aggregates/inbound-delivery.aggregate';
import type { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';

export interface ReceivedDelivery {
  readonly integration: string;
  readonly to: DeliveryAddressee | null;
  readonly id: string;
  readonly headers: WebhookHeaders;
  readonly body: unknown;
  readonly causeFiringId: HookFiringId | null;
}
