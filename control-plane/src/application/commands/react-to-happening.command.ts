import type { StoredDelivery } from '@application/ports/delivery-inbox.port';

export class ReactToHappeningCommand {
  /** A delivery already taken in, being worked now that the host has gone. */
  constructor(readonly delivered: StoredDelivery) {}
}
