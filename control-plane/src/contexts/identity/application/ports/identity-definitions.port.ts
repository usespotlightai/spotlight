import type { TokenTerms } from '@identity/domain/aggregates/workspace-token.aggregate';
import type { TokenTrustTerms } from '@identity/domain/aggregates/workspace-token-trust.aggregate';
import type { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import type { TeamName } from '@identity/domain/value-objects/team-name.vo';
import type { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import type { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const IDENTITY_DEFINITIONS = Symbol('IDENTITY_DEFINITIONS');

type Refused = {
  readonly ok: false;
  readonly problems: readonly ConfigurationProblem[];
};

export type CompiledWorkspace =
  | {
      readonly ok: true;
      readonly name: WorkspaceName;
      readonly slug: WorkspaceSlug;
    }
  | Refused;

export type CompiledTeam =
  | { readonly ok: true; readonly key: TeamKey; readonly name: TeamName }
  | Refused;

export type CompiledWorkspaceToken =
  | { readonly ok: true; readonly terms: TokenTerms }
  | Refused;

export type CompiledWorkspaceTokenTrust =
  | { readonly ok: true; readonly terms: TokenTrustTerms }
  | Refused;

export interface IdentityDefinitionsPort {
  workspace(held: unknown): CompiledWorkspace;

  team(held: unknown): CompiledTeam;

  workspaceToken(held: unknown): CompiledWorkspaceToken;

  workspaceTokenTrust(held: unknown): CompiledWorkspaceTokenTrust;
}
