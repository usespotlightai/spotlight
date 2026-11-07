import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class EgressVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(egressId: string) {
    super(
      `Egress ${egressId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'EgressVersionConflictError';
  }
}
