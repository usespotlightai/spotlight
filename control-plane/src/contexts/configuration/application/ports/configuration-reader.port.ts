import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const CONFIGURATION_READER = Symbol('CONFIGURATION_READER');

interface ReadIntegrationView {
  readonly source: string;
  readonly name: string;
  readonly path: string;
  readonly connectable: boolean;
  readonly linked: boolean;
  readonly handle: string | null;
}

export interface ConfigurationView {
  readonly integrations: readonly ReadIntegrationView[];
}

export interface ConfigurationReaderPort {
  of(teamId: TeamId): Promise<ConfigurationView>;
}
