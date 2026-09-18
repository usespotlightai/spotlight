export class ChangedSinceReadError extends Error {
  readonly violation = 'conflict' as const;

  constructor(what: string, id: string) {
    super(
      `This ${what} changed since it was read, and cannot be written over (${id})`,
    );
    this.name = 'ChangedSinceReadError';
  }
}
