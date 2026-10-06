export class HostTakenError extends Error {
  readonly violation = 'conflict' as const;

  constructor(hostId: string) {
    super(
      `Host ${hostId} is serving another pool or trust. Please stop it there, or give it its own state directory.`,
    );
    this.name = 'HostTakenError';
  }
}
