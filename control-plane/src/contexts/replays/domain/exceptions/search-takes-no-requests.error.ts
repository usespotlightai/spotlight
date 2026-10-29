export class SearchTakesNoRequestsError extends Error {
  readonly kind = 'conflict' as const;

  constructor(searchId: string) {
    super(`The search ${searchId} takes no more candidates`);
    this.name = 'SearchTakesNoRequestsError';
  }
}
