import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NowhereToProposeError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A task cannot be proposed there: ${reason}`);
    this.name = 'NowhereToProposeError';
  }
}
