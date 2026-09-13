import type { StoredDelivery } from '@application/ports/delivery-inbox.port';

export class ReactToHappeningCommand {
  constructor(readonly delivered: StoredDelivery) {}
}
