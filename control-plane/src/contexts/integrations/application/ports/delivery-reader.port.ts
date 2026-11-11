import type {
  Delivered,
  WebhookProviderPort,
} from '@integrations/application/ports/webhook-provider.port';
import type { DeliveryFailure } from '@integrations/domain/value-objects/delivery-failure.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';

export const DELIVERY_READER = Symbol('DELIVERY_READER');

export type DeliveryReading =
  | { readonly kind: 'read'; readonly happenings: readonly Happened[] }
  | { readonly kind: 'failed'; readonly failure: DeliveryFailure };

export interface DeliveryReaderPort {
  receive(
    provider: WebhookProviderPort,
    delivered: Delivered,
  ): Promise<DeliveryFailure | null>;

  read(
    provider: WebhookProviderPort,
    delivered: Delivered,
  ): Promise<DeliveryReading>;
}
