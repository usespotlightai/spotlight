import type { ReceivedDelivery } from '@integrations/application/dto/received-delivery.dto';

export class ReadDeliveryCommand {
  constructor(readonly delivered: ReceivedDelivery) {}
}
