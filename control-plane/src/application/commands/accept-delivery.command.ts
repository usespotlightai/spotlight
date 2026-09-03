import type { Delivered } from '@application/ports/webhook-source.port';

export class AcceptDeliveryCommand {
  constructor(
    /** Which host this came from, as the world addresses it. */
    readonly source: string,
    /** Whose repository the team's files are read from. */
    readonly workspaceId: string,
    /** Whose door it knocked at, or empty where it knocked at the shared one. */
    readonly teamId: string,
    readonly teamKey: string,
    readonly delivered: Delivered,
  ) {}
}
