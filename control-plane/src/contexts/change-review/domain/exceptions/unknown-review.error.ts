import { capitalised } from '@shared-kernel/domain/capitalised';

export class UnknownReviewError extends Error {
  readonly kind = 'not-found' as const;

  constructor(what: string) {
    super(`${capitalised(what)} not found.`);
    this.name = 'UnknownReviewError';
  }
}
