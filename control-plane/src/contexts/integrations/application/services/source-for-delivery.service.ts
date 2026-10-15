import type { ConfiguredSourcesPort } from '@integrations/application/ports/configured-sources.port';
import type { WebhookSourcePort } from '@integrations/application/ports/webhook-source.port';
import type { WebhookSources } from '@integrations/application/services/webhook-sources.service';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

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

    // Built-in sources have priority, so a team file cannot take the deliveries of a built-in host.
    if (this.registered.find(addressed.source)) {
      return null;
    }

    return this.configured.find(
      {
        workspaceId: WorkspaceId.of(addressed.workspaceId),
        teamId: TeamId.of(addressed.teamId),
        teamKey: addressed.teamKey,
      },
      addressed.source,
    );
  }
}
