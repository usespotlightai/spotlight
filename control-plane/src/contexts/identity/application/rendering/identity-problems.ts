import type { InvalidOidcTrustError } from '@identity/domain/exceptions/invalid-oidc-trust.error';
import type { InvalidWorkspaceTokenError } from '@identity/domain/exceptions/invalid-workspace-token.error';
import type { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const WORKSPACE = 'workspace';

export const TEAM = 'team';

export const WORKSPACE_TOKEN = 'workspace-token';

export const OIDC_TRUST = 'oidc-trust';

export const IdentityProblems = {
  immutableField(
    path: string,
    error: ImmutableFieldError,
  ): ConfigurationProblem {
    return ConfigurationProblem.of({
      path,
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },

  tokenInvalid(
    error: InvalidWorkspaceTokenError | ImmutableFieldError,
  ): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: WORKSPACE_TOKEN,
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },

  trustInvalid(
    error: InvalidOidcTrustError | ImmutableFieldError,
  ): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: OIDC_TRUST,
      at: FieldPath.of(error.field.split('.')),
      reason: error.because,
    });
  },
};
