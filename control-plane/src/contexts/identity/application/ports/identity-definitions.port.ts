import type { OidcTrustSpec } from '@identity/domain/aggregates/oidc-trust.aggregate';
import type { WorkspaceDefinition } from '@identity/domain/aggregates/workspace.aggregate';
import type { TokenSpec } from '@identity/domain/aggregates/workspace-token.aggregate';
import type { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import type { TeamName } from '@identity/domain/value-objects/team-name.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const IDENTITY_DEFINITIONS = Symbol('IDENTITY_DEFINITIONS');

type Invalid = {
  readonly ok: false;
  readonly problems: readonly ConfigurationProblem[];
};

export type ParsedWorkspace =
  | ({ readonly ok: true } & WorkspaceDefinition)
  | Invalid;

export type ParsedTeam =
  | { readonly ok: true; readonly key: TeamKey; readonly name: TeamName }
  | Invalid;

export type ParsedWorkspaceToken =
  | { readonly ok: true; readonly spec: TokenSpec }
  | Invalid;

export type ParsedOidcTrust =
  | { readonly ok: true; readonly spec: OidcTrustSpec }
  | Invalid;

export interface IdentityDefinitionsPort {
  workspace(input: unknown): ParsedWorkspace;

  team(input: unknown): ParsedTeam;

  workspaceToken(input: unknown): ParsedWorkspaceToken;

  oidcTrust(input: unknown): ParsedOidcTrust;
}
