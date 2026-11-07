import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';

export class InboundDeliveryId {
  private readonly kind = 'inbound-delivery-id';

  private constructor(readonly value: string) {}

  static of(raw: string): InboundDeliveryId {
    if (raw.trim() === '') {
      throw new InvalidIntegrationPartError('delivery', 'names no delivery id');
    }

    return new InboundDeliveryId(raw);
  }

  equals(other: InboundDeliveryId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
