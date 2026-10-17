import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const INTEGRATION_READER = Symbol('INTEGRATION_READER');

export interface ApiSpecSummary {
  readonly kind: string;
  readonly tools: number;
  readonly readAt: Date;
  readonly problem: string | null;
}

interface IntegrationSummary {
  readonly integration: string;
  readonly path: string;
  readonly name: string;
  readonly requiresConnection: boolean;
  readonly actsAs: 'team' | 'requester';
  readonly connected: boolean;
  readonly linkedAccount: string | null;
  readonly credentials: readonly SecretName[];
  readonly spec: ApiSpecSummary | null;
}

export interface ReadIntegrations {
  readonly integrations: readonly IntegrationSummary[];
  readonly problems: readonly ConfigurationProblem[];
}

export interface IntegrationReaderPort {
  ofTeam(teamId: TeamId): Promise<ReadIntegrations>;
}
