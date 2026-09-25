export class HostTakenError extends Error {
  readonly violation = 'conflict' as const;

  constructor(hostId: string) {
    super(
      `The host ${hostId} is serving another pool or trust right now; stop it there, or give this one its own state directory`,
    );
    this.name = 'HostTakenError';
  }
}
