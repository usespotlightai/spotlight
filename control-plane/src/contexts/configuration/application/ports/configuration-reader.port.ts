import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const CONFIGURATION_READER = Symbol('CONFIGURATION_READER');

interface ReadIntegrationView {
  readonly source: string;
  readonly name: string;
  readonly path: string;
  readonly connectable: boolean;
}

export interface ConfigurationView {
  readonly keptIn: string | null;
  readonly movingTo: string | null;
  readonly read: {
    readonly repository: string;
    readonly sha: string;
    readonly integrations: readonly ReadIntegrationView[];
  } | null;
}

export interface ConfigurationReaderPort {
  of(teamId: TeamId): Promise<ConfigurationView>;
}
