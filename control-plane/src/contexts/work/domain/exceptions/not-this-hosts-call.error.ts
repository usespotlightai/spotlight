export class NotThisHostsCallError extends Error {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(`Network call ${id} is claimed by another host.`);
    this.name = 'NotThisHostsCallError';
  }
}
