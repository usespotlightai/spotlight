import type { ConfigPullRequestError } from '@replays/domain/value-objects/config-pull-request-state';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class ConfigRepositoryError extends ApplicationError {
  readonly kind = 'upstream-error' as const;

  constructor(
    readonly code: ConfigPullRequestError,
    reason: string,
  ) {
    super(reason);
    this.name = 'ConfigRepositoryError';
  }
}
