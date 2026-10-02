export class KeptFromSearchesError extends Error {
  readonly violation = 'conflict' as const;

  constructor(what: string) {
    super(
      `A search may not ${what}: what the team remembers stays out of a search`,
    );
    this.name = 'KeptFromSearchesError';
  }
}
