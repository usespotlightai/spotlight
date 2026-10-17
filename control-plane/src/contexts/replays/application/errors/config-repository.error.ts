import type { ConfigPullRequestError } from '@replays/domain/value-objects/config-pull-request-state';

export class ConfigRepositoryError extends Error {
  readonly violation = 'upstream-error' as const;

  constructor(
    readonly code: ConfigPullRequestError,
    reason: string,
  ) {
    super(reason);
    this.name = 'ConfigRepositoryError';
  }
}
