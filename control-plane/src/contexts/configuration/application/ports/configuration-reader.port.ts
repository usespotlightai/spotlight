import type { ApiSpecSummary } from '@configuration/application/ports/integration-reader.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const CONFIGURATION_READER = Symbol('CONFIGURATION_READER');

interface ReadIntegrationView {
  readonly integration: string;
  readonly name: string;
  readonly path: string;
  readonly requiresConnection: boolean;
  readonly actsAs: 'team' | 'requester';
  readonly connected: boolean;
  readonly linkedAccount: string | null;
  readonly spec: ApiSpecSummary | null;
}

export interface ConfigurationView {
  readonly integrations: readonly ReadIntegrationView[];
}

export interface ConfigurationReaderPort {
  of(teamId: TeamId): Promise<ConfigurationView>;
}
