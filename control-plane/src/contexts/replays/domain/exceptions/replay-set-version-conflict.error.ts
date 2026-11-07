import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ReplaySetVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(setId: string) {
    super(
      `Replay set ${setId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ReplaySetVersionConflictError';
  }
}
