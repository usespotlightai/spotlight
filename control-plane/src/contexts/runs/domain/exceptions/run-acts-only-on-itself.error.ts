import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunActsOnlyOnItselfError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(what: string) {
    super(`This run may not ${what}: it acts only on itself`);
    this.name = 'RunActsOnlyOnItselfError';
  }
}
