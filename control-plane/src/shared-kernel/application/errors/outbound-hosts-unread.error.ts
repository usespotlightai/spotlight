export class OutboundHostsUnreadError extends Error {
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
