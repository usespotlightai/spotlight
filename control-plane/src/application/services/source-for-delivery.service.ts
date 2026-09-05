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
 * Two kinds of door, and the address says which: a host Spotlight was written
 * for speaks for everyone, a host a team declared has one of its own.
 *
 * The guard and the worker both ask here, so they resolve it alike.
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
