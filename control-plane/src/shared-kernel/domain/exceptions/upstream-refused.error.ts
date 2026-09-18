export class UpstreamRefusedError extends Error {
  readonly violation = 'refused' as const;

  constructor(asking: string, reason: string) {
    super(`${asking}: ${reason}`);
    this.name = 'UpstreamRefusedError';
  }
}
