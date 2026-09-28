import type { IdentityResourcesPort } from '@identity/application/ports/identity-resources.port';
import type { TeamHoldingsPort } from '@identity/application/ports/team-holdings.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { Team } from '@identity/domain/aggregates/team.aggregate';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { IdempotentCreatesPort } from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

export const OWNER = UserId.of('user_1');

export const MEMBER = UserId.of('user_2');

export const workspaceAt = (version: number) =>
  Workspace.rehydrate({
    id: WORKSPACE,
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: [
      { userId: OWNER, role: WorkspaceRole.owner },
      { userId: MEMBER, role: WorkspaceRole.member },
    ],
    version,
  });

export const teamAt = (version: number, key = 'core') =>
  Team.rehydrate({
    id: TeamId.of('team_1'),
    workspaceId: WORKSPACE,
    key: TeamKey.of(key),
    name: TeamName.of('Core'),
    members: [OWNER],
    version,
  });

export const workspaces = (
  over: {
    standing?: Workspace | null;
    refusing?: Error;
    thenAt?: Workspace | null;
    taken?: boolean;
  } = {},
) => {
  const find = vi.fn(async () => over.standing ?? null);

  return {
    find,
    findBySlug: find,
    isTaken: vi.fn(async () => over.taken ?? false),
    add: vi.fn(async (_: Workspace) => {}),
    save: vi.fn(async (_: Workspace) => {
      if (over.refusing) {
        find.mockResolvedValue(over.thenAt ?? null);
        throw over.refusing;
      }
    }),
  } satisfies WorkspaceRepository;
};

export const teams = (
  over: {
    standing?: Team | null;
    held?: readonly Team[];
    refusing?: Error;
    thenAt?: Team | null;
  } = {},
) => {
  const find = vi.fn(async () => over.standing ?? null);

  return {
    find,
    named: find,
    ofWorkspace: vi.fn(async () => over.held ?? []),
    add: vi.fn(async (_: Team) => {
      if (over.refusing) {
        throw over.refusing;
      }
    }),
    save: vi.fn(async (_: Team) => {
      if (over.refusing) {
        find.mockResolvedValue(over.thenAt ?? null);
        throw over.refusing;
      }
    }),
  } satisfies TeamRepository;
};

export const access = (administers = true): WorkspaceAccessPort =>
  ({
    clearanceIn: vi.fn(async () => ({
      workspaceId: WORKSPACE,
      slug: 'acme',
      configures: administers,
      administers,
    })),
  }) as unknown as WorkspaceAccessPort;

export const teamKeys = (
  keys: readonly string[],
  tokens: readonly string[] = [],
  trusts: readonly string[] = [],
  minting: readonly string[] = [],
): IdentityResourcesPort =>
  ({
    teamKeysIn: vi.fn(async () => keys),
    tokenNamesIn: vi.fn(async () => tokens),
    tokenTrustKeysIn: vi.fn(async () => trusts),
    mintingTrustKeysIn: vi.fn(async () => minting),
  }) as unknown as IdentityResourcesPort;

export const holdings = (held: readonly string[] = []) =>
  ({
    register: vi.fn(),
    of: vi.fn(async () => held),
  }) satisfies TeamHoldingsPort;

export const creates = () =>
  ({
    claim: vi.fn(async () => ({ kind: 'fresh' as const })),
    created: vi.fn(async () => {}),
  }) satisfies IdempotentCreatesPort;

export const transaction: TransactionPort = { run: (work) => work() };
