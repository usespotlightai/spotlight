export class NetworkCallMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `This network call has changed since it was read, and cannot be written over (${id})`,
    );
    this.name = 'NetworkCallMovedOnError';
  }
}
