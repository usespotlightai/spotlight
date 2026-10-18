export class NotAllowedInSearchError extends Error {
  readonly kind = 'conflict' as const;

  constructor(what: string) {
    super(
      `A search may not ${what}: it proposes candidates and leaves nothing else behind`,
    );
    this.name = 'NotAllowedInSearchError';
  }
}
