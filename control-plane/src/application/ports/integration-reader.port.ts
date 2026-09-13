import type { Integration } from '@domain/entities/integration.entity';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';

export const INTEGRATION_READER = Symbol('INTEGRATION_READER');

export interface ReadIntegrations {
  readonly integrations: readonly Integration[];
  readonly problems: readonly ConfigurationProblem[];
}

export interface IntegrationReaderPort {
  read(files: readonly ConfigurationFile[]): ReadIntegrations;
}
