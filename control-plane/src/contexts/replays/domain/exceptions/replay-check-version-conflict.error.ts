import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ReplayCheckVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(checkId: string) {
    super(
      `Replay check ${checkId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ReplayCheckVersionConflictError';
  }
}
