import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ReplaySetFullError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(max: number) {
    super(`Replay set is full. Maximum runs: ${max}`);
    this.name = 'ReplaySetFullError';
  }
}
