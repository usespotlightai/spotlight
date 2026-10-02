export class UpstreamRefusedError extends Error {
  readonly violation = 'refused' as const;

  constructor(
    asking: string,
    reason: string,
    readonly status: number | null = null,
    readonly retryable = true,
  ) {
    super(`${asking}: ${reason}`);
    this.name = 'UpstreamRefusedError';
  }
}
