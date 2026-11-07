import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunnerHostVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(hostId: string) {
    super(
      `Host ${hostId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'RunnerHostVersionConflictError';
  }
}
