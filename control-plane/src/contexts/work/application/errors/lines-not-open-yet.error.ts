import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class LinesNotOpenYetError extends ApplicationError {
  readonly kind = 'conflict' as const;

  constructor(readonly teamId: string) {
    super(
      `The lines of team ${teamId} are not open yet, so there is nowhere to welcome it.`,
    );
    this.name = 'LinesNotOpenYetError';
  }
}
