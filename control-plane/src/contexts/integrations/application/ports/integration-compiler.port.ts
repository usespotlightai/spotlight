import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import type { DescribedOperation } from '@integrations/domain/value-objects/described-operation.vo';
import type { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const INTEGRATION_COMPILER = Symbol('INTEGRATION_COMPILER');

export interface DescribedOperations {
  readonly hash: ContentHash;
  readonly operations: readonly DescribedOperation[];
}

export type CompiledIntegration =
  | {
      readonly ok: true;
      readonly integration: Integration;
      readonly document: DefinitionDocument;
      readonly source: DescribedSource | null;
      readonly passedOver: readonly string[];
      readonly warnings: readonly ConfigurationProblem[];
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface IntegrationCompilerPort {
  compile(
    held: unknown,
    described?: DescribedOperations | null,
  ): CompiledIntegration;
}
