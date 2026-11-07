import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidTaskNoteError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Task note ${reason}.`);
    this.name = 'InvalidTaskNoteError';
  }
}
