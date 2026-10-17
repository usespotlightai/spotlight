import type { StoredDelivery } from '@integrations/application/ports/delivery-queue.port';

export class ReadDeliveryCommand {
  constructor(readonly delivered: StoredDelivery) {}
}
