export class NetworkCallMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `Network call ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'NetworkCallMovedOnError';
  }
}
