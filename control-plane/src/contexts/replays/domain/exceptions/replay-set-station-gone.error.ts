import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ReplaySetStationGoneError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(setId: string) {
    super(
      `The station of replay set ${setId} is gone from its line. Spotlight replays nothing on the set.`,
    );
    this.name = 'ReplaySetStationGoneError';
  }
}
