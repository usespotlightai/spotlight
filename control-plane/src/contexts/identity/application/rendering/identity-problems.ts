import type { InvalidWorkspaceTokenError } from '@identity/domain/exceptions/invalid-workspace-token.error';
import type { TeamKeyFixedError } from '@identity/domain/exceptions/team-key-fixed.error';
import type { WorkspaceSlugFixedError } from '@identity/domain/exceptions/workspace-slug-fixed.error';
import type { WorkspaceTokenTermsFixedError } from '@identity/domain/exceptions/workspace-token-terms-fixed.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const WORKSPACE = 'workspace';

export const TEAM = 'team';

export const WORKSPACE_TOKEN = 'workspace-token';

export const IdentityProblems = {
  slugFixed(error: WorkspaceSlugFixedError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: WORKSPACE,
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },

  keyFixed(error: TeamKeyFixedError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: TEAM,
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },

  tokenRefused(
    error: InvalidWorkspaceTokenError | WorkspaceTokenTermsFixedError,
  ): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: WORKSPACE_TOKEN,
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },
};
