export class HostInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(hostId: string) {
    super(
      `Host ${hostId} is in use by another pool or trust. Please stop it there, or give it its own state directory.`,
    );
    this.name = 'HostInUseError';
  }
}
