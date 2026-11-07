import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class UpstreamError extends ApplicationError {
  readonly kind = 'upstream-error' as const;

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
