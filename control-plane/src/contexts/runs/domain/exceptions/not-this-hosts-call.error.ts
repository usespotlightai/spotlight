import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotThisHostsCallError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(`Network call ${id} is claimed by another host.`);
    this.name = 'NotThisHostsCallError';
  }
}
