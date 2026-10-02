import type { ConfigPullRequestRefusal } from '@replays/domain/value-objects/config-pull-request-state';

export class ConfigRepositoryRefusedError extends Error {
  readonly violation = 'refused' as const;

  constructor(
    readonly code: ConfigPullRequestRefusal,
    reason: string,
  ) {
    super(reason);
    this.name = 'ConfigRepositoryRefusedError';
  }
}
