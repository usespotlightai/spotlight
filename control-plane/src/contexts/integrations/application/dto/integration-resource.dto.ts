import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export type DefinedIntegrationDto =
  | {
      readonly ok: true;
      readonly integration: DefinedIntegration;
      readonly warnings: readonly ConfigurationProblem[];
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };
