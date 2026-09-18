import type { WebhookSourcePort } from '@integrations/application/ports/webhook-source.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const CONFIGURED_SOURCES = Symbol('CONFIGURED_SOURCES');

export interface OfTeam {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly teamKey: string;
}

export interface ConfiguredSourcesPort {
  find(team: OfTeam, key: string): Promise<WebhookSourcePort | null>;

  all(team: OfTeam): Promise<readonly WebhookSourcePort[]>;
}
