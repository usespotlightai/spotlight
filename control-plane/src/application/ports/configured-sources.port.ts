import type { WebhookSourcePort } from '@application/ports/webhook-source.port';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { TeamKey } from '@domain/value-objects/team-key.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export const CONFIGURED_SOURCES = Symbol('CONFIGURED_SOURCES');

export interface OfTeam {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly teamKey: TeamKey;
}

export interface ConfiguredSourcesPort {
  find(team: OfTeam, key: string): Promise<WebhookSourcePort | null>;

  all(team: OfTeam): Promise<readonly WebhookSourcePort[]>;
}
