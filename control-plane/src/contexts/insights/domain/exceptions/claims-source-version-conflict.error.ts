import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ClaimsSourceVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(stationId: string, rubricVersion: string) {
    super(
      `Source of claims version ${rubricVersion} at station ${stationId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ClaimsSourceVersionConflictError';
  }
}
