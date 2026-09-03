import type { ConfiguredSourcesPort } from '@application/ports/configured-sources.port';
import type { WebhookSourcePort } from '@application/ports/webhook-source.port';
import type { WebhookSources } from '@application/services/webhook-sources.service';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/** Where a delivery knocked: one team's door, or the shared one. */
export interface Addressed {
  /** Whose repository the team's files are read from. */
  readonly workspaceId: string;
  /** Empty where the address named no team. */
  readonly teamId: string;
  readonly teamKey: string;
  readonly source: string;
}

/**
 * Which source answers for a delivery. There are two kinds of door and the
 * address says which was used: a host Spotlight was written for speaks for
 * every workspace at once and says whose word it is in the delivery, while a
 * host a team declared has a door of its own and needs to say nothing.
 *
 * Everything that reads a delivery asks here, so the guard at the door and
 * the worker that comes back to it later resolve it exactly alike.
 */
export class SourceForDelivery {
  constructor(
    private readonly registered: WebhookSources,
    private readonly configured: ConfiguredSourcesPort,
  ) {}

  async find(addressed: Addressed): Promise<WebhookSourcePort | null> {
    if (addressed.teamId === '') {
      return this.registered.find(addressed.source);
    }

    // A team cannot declare a host Spotlight was written for: the built-in
    // one wins, and a file claiming its name reaches nothing.
    if (this.registered.find(addressed.source)) {
      return null;
    }

    return this.configured.find(
      {
        workspaceId: WorkspaceId.of(addressed.workspaceId),
        teamId: TeamId.of(addressed.teamId),
        teamKey: TeamKey.of(addressed.teamKey),
      },
      addressed.source,
    );
  }
}
