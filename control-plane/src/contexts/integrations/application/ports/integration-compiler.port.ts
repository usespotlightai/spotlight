import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import type { SpecOperation } from '@integrations/domain/value-objects/spec-operation.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const INTEGRATION_COMPILER = Symbol('INTEGRATION_COMPILER');

export interface SpecOperations {
  readonly hash: ContentHash;
  readonly operations: readonly SpecOperation[];
}

export type ParsedIntegration =
  | {
      readonly ok: true;
      readonly integration: Integration;
      readonly document: DefinitionDocument;
      readonly spec: ApiSpec | null;
      readonly skipped: readonly string[];
      readonly warnings: readonly ConfigurationProblem[];
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface IntegrationCompilerPort {
  compile(
    raw: unknown,
    specOperations?: SpecOperations | null,
  ): ParsedIntegration;
}
