export class UnknownHappeningError extends Error {
  readonly violation = 'invalid' as const;

  constructor(happening: string) {
    super(
      `No source raises happening ${happening}. A wait on it would never end.`,
    );
    this.name = 'UnknownHappeningError';
  }
}
