import type { Delivered } from '@application/ports/webhook-source.port';

export class AcceptDeliveryCommand {
  constructor(
    readonly source: string,
    readonly workspaceId: string,
    readonly teamId: string,
    readonly teamKey: string,
    readonly delivered: Delivered,
  ) {}
}
