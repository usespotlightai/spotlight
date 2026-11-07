import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidTaskRankError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Task rank ${reason}.`);
    this.name = 'InvalidTaskRankError';
  }
}
