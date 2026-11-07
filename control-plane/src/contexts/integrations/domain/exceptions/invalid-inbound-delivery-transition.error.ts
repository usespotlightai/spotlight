import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidInboundDeliveryTransitionError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(reason: string) {
    super(`Inbound delivery ${reason}.`);
    this.name = 'InvalidInboundDeliveryTransitionError';
  }
}
