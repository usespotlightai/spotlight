export class UnknownHappeningError extends Error {
  readonly kind = 'invalid' as const;

  constructor(happening: string) {
    super(
      `No integration raises happening ${happening}. A wait on it would never end.`,
    );
    this.name = 'UnknownHappeningError';
  }
}
