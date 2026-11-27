import type { Dependent } from '@identity/application/ports/dependents.port';
import type { TeamDependentsPort } from '@identity/application/ports/team-dependents.port';
import type {
  WorkspaceAccessPort,
  WorkspacePermissions,
} from '@identity/application/ports/workspace-access.port';
import { OidcTrust } from '@identity/domain/aggregates/oidc-trust.aggregate';
import { Team } from '@identity/domain/aggregates/team.aggregate';
import { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import type { WorkspaceContents } from '@identity/domain/services/workspace-contents';
import { OidcTrustDescription } from '@identity/domain/value-objects/oidc-trust-description.vo';
import { OidcTrustId } from '@identity/domain/value-objects/oidc-trust-id.vo';
import { OidcTrustKey } from '@identity/domain/value-objects/oidc-trust-key.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { TokenDescription } from '@identity/domain/value-objects/token-description.vo';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { TokenScopes } from '@identity/domain/value-objects/token-scopes.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { WorkspaceTokenId } from '@identity/domain/value-objects/workspace-token-id.vo';
import type { IdempotentCreatesPort } from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { type Mock, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

interface WorkspacesFake extends WorkspaceRepository {
  readonly add: Mock<(workspace: Workspace) => Promise<void>>;
  readonly save: Mock<(workspace: Workspace) => Promise<void>>;
}

interface TeamsFake extends TeamRepository {
  readonly add: Mock<(team: Team) => Promise<void>>;
  readonly save: Mock<(team: Team) => Promise<void>>;
}

interface CreatesFake extends IdempotentCreatesPort {
  readonly reserve: Mock<IdempotentCreatesPort['reserve']>;
  readonly recordCreated: Mock<IdempotentCreatesPort['recordCreated']>;
}

export const OWNER = UserId.of('user_1');

export const MEMBER = UserId.of('user_2');

export const workspaceAt = (version: number): Workspace =>
  Workspace.rehydrate({
    id: WORKSPACE,
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: [
      { userId: OWNER, role: WorkspaceRole.owner, suspendedAt: null },
      { userId: MEMBER, role: WorkspaceRole.member, suspendedAt: null },
    ],
    version,
  });

export const teamAt = (version: number, key = 'core'): Team =>
  Team.rehydrate({
    id: TeamId.of('team_1'),
    workspaceId: WORKSPACE,
    key: TeamKey.of(key),
    name: TeamName.of('Core'),
    origin: 'configuration',
    members: [OWNER],
    version,
  });

export const workspaces = (
  over: {
    existing?: Workspace | null;
    throwing?: Error;
    thenAt?: Workspace | null;
    taken?: boolean;
  } = {},
): WorkspacesFake => {
  const find = vi.fn(() => Promise.resolve(over.existing ?? null));

  return {
    find,
    findBySlug: find,
    isTaken: vi.fn(() => Promise.resolve(over.taken ?? false)),
    add: vi.fn<(workspace: Workspace) => Promise<void>>(async () => {}),
    save: vi.fn<(workspace: Workspace) => Promise<void>>(() => {
      if (over.throwing) {
        find.mockResolvedValue(over.thenAt ?? null);
        return Promise.reject(over.throwing);
      }
      return Promise.resolve();
    }),
  } satisfies WorkspaceRepository;
};

export const teams = (
  over: {
    existing?: Team | null;
    inWorkspace?: readonly Team[];
    throwing?: Error;
    thenAt?: Team | null;
  } = {},
): TeamsFake => {
  const find = vi.fn(() => Promise.resolve(over.existing ?? null));

  return {
    find,
    named: find,
    ofWorkspace: vi.fn(() => Promise.resolve(over.inWorkspace ?? [])),
    add: vi.fn<(team: Team) => Promise<void>>(() => {
      if (over.throwing) {
        return Promise.reject(over.throwing);
      }
      return Promise.resolve();
    }),
    save: vi.fn<(team: Team) => Promise<void>>(() => {
      if (over.throwing) {
        find.mockResolvedValue(over.thenAt ?? null);
        return Promise.reject(over.throwing);
      }
      return Promise.resolve();
    }),
  } satisfies TeamRepository;
};

export const access = (isAdmin = true): WorkspaceAccessPort =>
  partial<WorkspaceAccessPort>({
    permissionsIn: vi.fn(() =>
      Promise.resolve(
        partial<WorkspacePermissions>({
          workspaceId: WORKSPACE,
          slug: 'acme',
          configures: isAdmin,
          isAdmin,
        }),
      ),
    ),
  });

export const handIssued = (name: string): WorkspaceToken =>
  WorkspaceToken.rehydrate({
    id: WorkspaceTokenId.of(`token_${name}`),
    workspaceId: WORKSPACE,
    name: TokenName.of(name),
    description: TokenDescription.of(''),
    scopes: TokenScopes.named(['plan']),
    hash: TokenHash.of('a'.repeat(64)),
    issuedBy: OWNER,
    issuedAt: new Date('2026-09-01T09:00:00.000Z'),
    expiresAt: null,
    issuedByTrustId: null,
    trustVersion: null,
    runId: null,
    runAttempt: null,
    version: 0,
  });

export const issuedBy = (trust: OidcTrust): WorkspaceToken =>
  WorkspaceToken.rehydrate({
    id: WorkspaceTokenId.of(`token_by_${trust.key.value}`),
    workspaceId: WORKSPACE,
    name: TokenName.of(trust.key.value),
    description: TokenDescription.of(''),
    scopes: TokenScopes.named(['plan']),
    hash: TokenHash.of('b'.repeat(64)),
    issuedBy: OWNER,
    issuedAt: new Date('2026-09-01T09:00:00.000Z'),
    expiresAt: new Date('2026-09-01T10:00:00.000Z'),
    issuedByTrustId: trust.id,
    trustVersion: trust.grantVersion,
    runId: null,
    runAttempt: null,
    version: 0,
  });

export const oidcTrustKeyed = (
  key: string,
  subject = 'repo:acme/platform:ref:refs/heads/main',
): OidcTrust =>
  OidcTrust.rehydrate({
    id: OidcTrustId.of(`trust_${key}`),
    workspaceId: WORKSPACE,
    key: OidcTrustKey.of(key),
    workload: WorkloadRule.of({
      issuer: 'https://token.actions.githubusercontent.com',
      audience: 'spotlight',
      subject,
      claims: {},
    }),
    scopes: TokenScopes.named(['plan']),
    lifetime: TokenLifetime.ofMinutes(15),
    description: OidcTrustDescription.of(''),
    createdBy: OWNER,
    createdAt: new Date('2026-09-01T09:00:00.000Z'),
    version: 0,
    grantVersion: 0,
  });

export const contents = (
  over: {
    teams?: readonly Team[];
    tokens?: readonly WorkspaceToken[];
    trusts?: readonly OidcTrust[];
  } = {},
): WorkspaceContents => ({
  teams: over.teams ?? [],
  tokens: over.tokens ?? [],
  trusts: over.trusts ?? [],
});

export const dependents = (
  all: readonly Dependent[] = [],
): TeamDependentsPort => ({
  register: vi.fn(),
  of: vi.fn(() => Promise.resolve(all)),
});

export const creates = (): CreatesFake => ({
  reserve: vi.fn<IdempotentCreatesPort['reserve']>(() =>
    Promise.resolve({ kind: 'new' }),
  ),
  recordCreated: vi.fn<IdempotentCreatesPort['recordCreated']>(async () => {}),
});

export const transaction: TransactionPort = { inTransaction: (work) => work() };
