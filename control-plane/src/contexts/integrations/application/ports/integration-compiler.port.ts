import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const INTEGRATION_COMPILER = Symbol('INTEGRATION_COMPILER');

export type CompiledIntegration =
  | {
      readonly ok: true;
      readonly integration: Integration;
      readonly document: DefinitionDocument;
      readonly warnings: readonly ConfigurationProblem[];
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface IntegrationCompilerPort {
  compile(held: unknown): CompiledIntegration;
}
