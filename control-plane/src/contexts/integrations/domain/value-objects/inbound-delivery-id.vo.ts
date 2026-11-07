import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class InboundDeliveryId {
  private readonly kind = 'inbound-delivery-id';

  private constructor(readonly value: string) {}

  static rehydrate(stored: string): InboundDeliveryId {
    try {
      return InboundDeliveryId.of(stored);
    } catch {
      throw new InconsistentStateError(
        'inbound delivery id',
        'was stored in a shape it cannot take',
      );
    }
  }

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
