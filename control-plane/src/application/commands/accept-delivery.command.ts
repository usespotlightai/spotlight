import type { Delivered } from '@application/ports/webhook-source.port';

export class AcceptDeliveryCommand {
  constructor(
    /** Which host this came from, as the world addresses it. */
    readonly source: string,
    readonly delivered: Delivered,
  ) {}
}
