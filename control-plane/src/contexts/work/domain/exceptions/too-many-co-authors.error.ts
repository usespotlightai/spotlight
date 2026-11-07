import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TooManyCoAuthorsError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(limit: number) {
    super(`A message can name at most ${limit} co-authors.`);
    this.name = 'TooManyCoAuthorsError';
  }
}
