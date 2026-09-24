import type { SecretDefinition } from '@secrets/domain/aggregates/secret.aggregate';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const SECRET_DEFINITIONS = Symbol('SECRET_DEFINITIONS');

export type CompiledSecret =
  | ({ readonly ok: true } & SecretDefinition)
  | {
      readonly ok: false;
      readonly problems: readonly ConfigurationProblem[];
    };

export interface SecretDefinitionsPort {
  secret(held: unknown): CompiledSecret;
}
