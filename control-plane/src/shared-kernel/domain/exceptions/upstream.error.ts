export class UpstreamError extends Error {
  readonly violation = 'upstream-error' as const;

  constructor(
    operation: string,
    reason: string,
    readonly status: number | null = null,
    readonly retryable = true,
  ) {
    super(`${operation}: ${reason}`);
    this.name = 'UpstreamError';
  }
}
