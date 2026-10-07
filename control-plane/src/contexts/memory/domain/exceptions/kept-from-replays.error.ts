export class KeptFromReplaysError extends Error {
  readonly violation = 'conflict' as const;

  constructor(what: string) {
    super(`A replay cannot ${what}.`);
    this.name = 'KeptFromReplaysError';
  }
}
