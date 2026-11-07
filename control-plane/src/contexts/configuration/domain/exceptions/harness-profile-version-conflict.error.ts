import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class HarnessProfileVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(
      `Harness profile ${key} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'HarnessProfileVersionConflictError';
  }
}
