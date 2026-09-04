import type { WebhookSourcePort } from '@application/ports/webhook-source.port';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { TeamKey } from '@domain/value-objects/team-key.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export const CONFIGURED_SOURCES = Symbol('CONFIGURED_SOURCES');

/** Which team's hosts to look among, and where its files are kept. */
export interface OfTeam {
  /** Whose repository the files are read from. One per workspace. */
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly teamKey: TeamKey;
}

/**
 * The hosts one team has told Spotlight about in its workspace's repository,
 * as against the ones Spotlight was written for.
 *
 * A team's own: two teams may reach the same host and sign with different
 * secrets, or reach different ones entirely, so these are asked for by team
 * rather than by name alone.
 */
export interface ConfiguredSourcesPort {
  find(team: OfTeam, key: string): Promise<WebhookSourcePort | null>;

  all(team: OfTeam): Promise<readonly WebhookSourcePort[]>;
}
