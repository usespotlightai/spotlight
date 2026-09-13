import type { ConfiguredSourcesPort } from '@application/ports/configured-sources.port';
import type { WebhookSourcePort } from '@application/ports/webhook-source.port';
import type { WebhookSources } from '@application/services/webhook-sources.service';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export interface Addressed {
  readonly workspaceId: string;
  readonly teamId: string;
  readonly teamKey: string;
  readonly source: string;
}

export class SourceForDelivery {
  constructor(
    private readonly registered: WebhookSources,
    private readonly configured: ConfiguredSourcesPort,
  ) {}

  async find(addressed: Addressed): Promise<WebhookSourcePort | null> {
    if (addressed.teamId === '') {
      return this.registered.find(addressed.source);
    }

    // Built-in sources win, so a team file cannot take over a built-in host's deliveries.
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
