import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class HostOutageVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(source: string) {
    super(
      `The outage of the hosts of ${source} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'HostOutageVersionConflictError';
  }
}
