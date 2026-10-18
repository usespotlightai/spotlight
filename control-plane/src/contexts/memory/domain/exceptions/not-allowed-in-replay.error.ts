export class NotAllowedInReplayError extends Error {
  readonly kind = 'conflict' as const;

  constructor(what: string) {
    super(`A replay cannot ${what}.`);
    this.name = 'NotAllowedInReplayError';
  }
}
