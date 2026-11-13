import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidAvatarError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Avatar ${because}.`);
    this.name = 'InvalidAvatarError';
  }
}
