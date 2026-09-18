export class HostConnectionMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(source: string) {
    super(`The ${source} connection changed while it was being renewed`);
    this.name = 'HostConnectionMovedOnError';
  }
}
