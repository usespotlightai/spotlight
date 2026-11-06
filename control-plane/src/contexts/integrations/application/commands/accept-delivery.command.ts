import type { DeliveryAddressee } from '@integrations/application/ports/delivery-queue.port';
import type { Delivered } from '@integrations/application/ports/webhook-provider.port';

export class AcceptDeliveryCommand {
  constructor(
    readonly integration: string,
    readonly to: DeliveryAddressee | null,
    readonly delivered: Delivered,
  ) {}
}
