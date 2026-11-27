import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class DuplicateCheckVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(runId: string) {
    super(
      `The duplicate check of run ${runId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'DuplicateCheckVersionConflictError';
  }
}
