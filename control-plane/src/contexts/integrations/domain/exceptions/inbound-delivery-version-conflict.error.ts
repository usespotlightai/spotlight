import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InboundDeliveryVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Inbound delivery ${id} changed since it was loaded. Please try again.`,
    );
    this.name = 'InboundDeliveryVersionConflictError';
  }
}
