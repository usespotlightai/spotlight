export class KeptFromSearchesError extends Error {
  readonly violation = 'conflict' as const;

  constructor(what: string) {
    super(
      `A search may not ${what}: it proposes candidates and leaves nothing else behind`,
    );
    this.name = 'KeptFromSearchesError';
  }
}
