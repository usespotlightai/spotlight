export class UpstreamError extends Error {
  readonly violation = 'upstream-error' as const;

  constructor(
    asking: string,
    reason: string,
    readonly status: number | null = null,
    readonly retryable = true,
  ) {
    super(`${asking}: ${reason}`);
    this.name = 'UpstreamError';
  }
}
