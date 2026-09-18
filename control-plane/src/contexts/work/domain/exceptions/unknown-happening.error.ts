export class UnknownHappeningError extends Error {
  readonly violation = 'invalid' as const;

  constructor(happening: string) {
    super(`No source here raises "${happening}", so nothing would ever wait`);
    this.name = 'UnknownHappeningError';
  }
}
