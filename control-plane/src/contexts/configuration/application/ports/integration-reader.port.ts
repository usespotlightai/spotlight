import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';

export const INTEGRATION_READER = Symbol('INTEGRATION_READER');

export interface IntegrationSummary {
  readonly source: string;
  readonly path: string;
  readonly name: string;
  readonly connects: boolean;
  readonly credentials: readonly SecretName[];
  readonly offers: readonly ToolDeclaration[];
}

export interface ReadIntegrations {
  readonly integrations: readonly IntegrationSummary[];
  readonly problems: readonly ConfigurationProblem[];
}

export interface IntegrationReaderPort {
  read(files: readonly ConfigurationFile[]): ReadIntegrations;
}
