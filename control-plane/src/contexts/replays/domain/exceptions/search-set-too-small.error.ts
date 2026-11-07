import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SearchSetTooSmallError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly tasks: number,
    readonly heldOut: number,
  ) {
    super(
      `A search needs at least 2 held-out tasks and 3 searched tasks. The replay set covers ${tasks} tasks. Held out: ${heldOut}`,
    );
    this.name = 'SearchSetTooSmallError';
  }
}
