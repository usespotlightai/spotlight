import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class OutboundHostsUnreadError extends ApplicationError {
  readonly kind = 'upstream-error' as const;

  constructor(
    readonly workspaceId: string,
    readonly because: string,
  ) {
    super(
      `Spotlight could not read the allowed hosts of workspace ${workspaceId}: ${because}`,
    );
    this.name = 'OutboundHostsUnreadError';
  }
}
