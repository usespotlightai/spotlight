export class NotThisHostsCallError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(`The network call ${id} was claimed by another host`);
    this.name = 'NotThisHostsCallError';
  }
}
