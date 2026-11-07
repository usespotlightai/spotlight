import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidCallbackNoteError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(longest: number) {
    super(`Note must not be empty. Maximum length: ${longest} characters`);
    this.name = 'InvalidCallbackNoteError';
  }
}
