import type {
  DeliveryReaderPort,
  DeliveryReading,
} from '@integrations/application/ports/delivery-reader.port';
import type {
  Delivered,
  WebhookProviderPort,
} from '@integrations/application/ports/webhook-provider.port';
import { deliveryFailureOf } from '@integrations/infrastructure/webhooks/delivery-failures';

export class ProviderDeliveryReader implements DeliveryReaderPort {
  async read(
    provider: WebhookProviderPort,
    delivered: Delivered,
  ): Promise<DeliveryReading> {
    try {
      return { kind: 'read', happenings: await provider.read(delivered) };
    } catch (error) {
      const failure = deliveryFailureOf(error);

      if (!failure) {
        throw error;
      }

      return { kind: 'failed', failure };
    }
  }
}
