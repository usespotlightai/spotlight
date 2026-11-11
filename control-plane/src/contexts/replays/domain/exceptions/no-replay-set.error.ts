import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NoReplaySetError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(stationKey: string) {
    super(
      `Station ${stationKey} has no replay set yet. Spotlight keeps one after a run of the station ends.`,
    );
    this.name = 'NoReplaySetError';
  }
}
