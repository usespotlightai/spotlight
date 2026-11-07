import type { WebhookHeaders } from '@integrations/application/ports/webhook-provider.port';
import type { DeliveryAddressee } from '@integrations/domain/aggregates/inbound-delivery.aggregate';

export interface ReceivedDelivery {
  readonly integration: string;
  readonly to: DeliveryAddressee | null;
  readonly id: string;
  readonly headers: WebhookHeaders;
  readonly body: unknown;
  readonly causeFiringId: string | null;
}
