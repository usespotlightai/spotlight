export class HostConnectionMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(source: string) {
    super(
      `Connection ${source} changed while it was being renewed. Please try again.`,
    );
    this.name = 'HostConnectionMovedOnError';
  }
}
