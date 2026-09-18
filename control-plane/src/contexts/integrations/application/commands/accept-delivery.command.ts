import type { Delivered } from '@integrations/application/ports/webhook-source.port';

export class AcceptDeliveryCommand {
  constructor(
    readonly source: string,
    readonly workspaceId: string,
    readonly teamId: string,
    readonly teamKey: string,
    readonly delivered: Delivered,
  ) {}
}
