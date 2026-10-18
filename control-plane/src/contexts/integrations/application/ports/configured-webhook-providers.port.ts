import type { WebhookProviderPort } from '@integrations/application/ports/webhook-provider.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const CONFIGURED_WEBHOOK_PROVIDERS = Symbol(
  'CONFIGURED_WEBHOOK_PROVIDERS',
);

export interface OfTeam {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly teamKey: string;
}

export interface ConfiguredWebhookProvidersPort {
  find(team: OfTeam, key: string): Promise<WebhookProviderPort | null>;

  all(team: OfTeam): Promise<readonly WebhookProviderPort[]>;
}
