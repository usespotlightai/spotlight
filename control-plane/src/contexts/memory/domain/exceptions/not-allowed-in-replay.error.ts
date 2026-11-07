import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotAllowedInReplayError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(what: string) {
    super(`A replay cannot ${what}.`);
    this.name = 'NotAllowedInReplayError';
  }
}
