import type { Delivered } from '@integrations/application/ports/webhook-provider.port';

export interface DeliveryAddress {
  readonly slug: string;
  readonly teamKey: string;
}

export class AcceptDeliveryCommand {
  constructor(
    readonly integration: string,
    readonly addressedTo: DeliveryAddress | null,
    readonly delivered: Delivered,
    readonly causeFiringId: string | null,
  ) {}
}
