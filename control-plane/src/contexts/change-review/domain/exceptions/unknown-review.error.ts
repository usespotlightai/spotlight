import { capitalised } from '@shared-kernel/domain/capitalised';

export class UnknownReviewError extends Error {
  readonly violation = 'not-found' as const;

  constructor(what: string) {
    super(`${capitalised(what)} not found.`);
    this.name = 'UnknownReviewError';
  }
}
