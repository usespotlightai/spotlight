import type { TokenTerms } from '@identity/domain/aggregates/workspace-token.aggregate';
import type { TokenTrustTerms } from '@identity/domain/aggregates/workspace-token-trust.aggregate';
import type { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import type { TeamName } from '@identity/domain/value-objects/team-name.vo';
import type { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import type { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const IDENTITY_DEFINITIONS = Symbol('IDENTITY_DEFINITIONS');

type Invalid = {
  readonly ok: false;
  readonly problems: readonly ConfigurationProblem[];
};

export type ParsedWorkspace =
  | {
      readonly ok: true;
      readonly name: WorkspaceName;
      readonly slug: WorkspaceSlug;
    }
  | Invalid;

export type ParsedTeam =
  | { readonly ok: true; readonly key: TeamKey; readonly name: TeamName }
  | Invalid;

export type ParsedWorkspaceToken =
  | { readonly ok: true; readonly terms: TokenTerms }
  | Invalid;

export type ParsedWorkspaceTokenTrust =
  | { readonly ok: true; readonly terms: TokenTrustTerms }
  | Invalid;

export interface IdentityDefinitionsPort {
  workspace(input: unknown): ParsedWorkspace;

  team(input: unknown): ParsedTeam;

  workspaceToken(input: unknown): ParsedWorkspaceToken;

  workspaceTokenTrust(input: unknown): ParsedWorkspaceTokenTrust;
}
