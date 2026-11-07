import type { OidcTrust } from '@identity/domain/aggregates/oidc-trust.aggregate';
import type { Team } from '@identity/domain/aggregates/team.aggregate';
import type { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { Dependents } from '@identity/domain/value-objects/dependents.vo';
import type { OidcTrustId } from '@identity/domain/value-objects/oidc-trust-id.vo';

export interface WorkspaceContents {
  readonly teams: readonly Team[];
  readonly tokens: readonly WorkspaceToken[];
  readonly trusts: readonly OidcTrust[];
}

export const dependentsInWorkspace = (
  contents: WorkspaceContents,
): Dependents => {
  const trustKeyOf = (trustId: OidcTrustId): string =>
    contents.trusts.find((each) => each.id.equals(trustId))?.key.value ??
    'a deleted OIDC trust';
  const issuing = [
    ...new Set(
      contents.tokens.flatMap((each) =>
        each.issuedByTrustId ? [trustKeyOf(each.issuedByTrustId)] : [],
      ),
    ),
  ];

  return Dependents.of([
    ...contents.teams.map((each) => ({
      kind: 'team' as const,
      key: each.key.value,
    })),
    ...contents.tokens
      .filter((each) => !each.isIssuedBySpotlight)
      .map((each) => ({
        kind: 'workspace-token' as const,
        key: each.name.value,
      })),
    ...contents.trusts.map((each) => ({
      kind: 'oidc-trust' as const,
      key: each.key.value,
    })),
    ...issuing.map((key) => ({ kind: 'issued-tokens' as const, key })),
  ]);
};
