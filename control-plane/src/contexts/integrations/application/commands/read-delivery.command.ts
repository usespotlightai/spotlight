import type { StoredDelivery } from '@integrations/application/ports/delivery-inbox.port';

export class ReadDeliveryCommand {
  constructor(readonly delivered: StoredDelivery) {}
}
