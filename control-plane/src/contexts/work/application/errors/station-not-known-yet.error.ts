import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class StationNotKnownYetError extends ApplicationError {
  readonly kind = 'conflict' as const;

  constructor(stationId: string) {
    super(
      `Station ${stationId} is not known to Work yet. Please try again in a moment.`,
    );
    this.name = 'StationNotKnownYetError';
  }
}
