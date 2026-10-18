import type { Delivered } from '@integrations/application/ports/webhook-provider.port';

export class AcceptDeliveryCommand {
  constructor(
    readonly integration: string,
    readonly workspaceId: string,
    readonly teamId: string,
    readonly teamKey: string,
    readonly delivered: Delivered,
  ) {}
}
