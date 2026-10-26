import { TrustKeyTakenError } from '@identity/application/errors/trust-key-taken.error';
import { TrustsNeedAnAdminError } from '@identity/application/errors/trusts-need-an-admin.error';
import { UnsafeBranchNameError } from '@identity/application/errors/unsafe-branch-name.error';
import type {
  WorkspaceAccessPort,
  WorkspacePermissions,
} from '@identity/application/ports/workspace-access.port';
import { GitHubActionsTrusts } from '@identity/application/services/github-actions-trusts.service';
import type { OidcTrust } from '@identity/domain/aggregates/oidc-trust.aggregate';
import type { OidcTrustRepository } from '@identity/domain/repositories/oidc-trust.repository';
import { ScopeCeiling } from '@identity/domain/value-objects/scope-ceiling.vo';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WANTED = {
  workspaceId: 'ws_1',
  by: 'admin_1',
  client: 'web',
  repository: 'acme/platform',
  repositoryId: '101',
  ownerId: '7',
  defaultBranch: 'main',
  applyScopes: ['configure', 'secrets', 'runners'],
};

const permissions = (managesOidcTrusts: boolean): WorkspacePermissions => ({
  workspaceId: WorkspaceId.of('ws_1'),
  slug: 'acme',
  plans: true,
  configures: managesOidcTrusts,
  managesSecrets: managesOidcTrusts,
  managesRunners: managesOidcTrusts,
  managesOidcTrusts,
  isAdmin: managesOidcTrusts,
});

const kept = () => {
  const stored = new Map<string, OidcTrust>();
  const trusts = {
    add: async (trust: OidcTrust) => {
      stored.set(trust.key.value, trust);
    },
    save: async (trust: OidcTrust) => {
      stored.set(trust.key.value, trust);
    },
    findByKey: async (_: WorkspaceId, key: { value: string }) =>
      stored.get(key.value) ?? null,
  } as unknown as OidcTrustRepository;

  return { stored, trusts };
};

const trusting = (admin = true) => {
  const { stored, trusts } = kept();
  let next = 0;
  const service = new GitHubActionsTrusts(
    {
      permissionsIn: async () => permissions(admin),
    } as unknown as WorkspaceAccessPort,
    trusts,
    { generate: () => `trust_${++next}` },
    { inTransaction: (work) => work() } as TransactionPort,
    {
      now: () => new Date('2026-10-26T10:00:00Z'),
      sleep: async () => undefined,
    },
  );

  return { service, stored };
};

describe('GitHubActionsTrusts', () => {
  it('lets pull requests plan and the default branch apply', async () => {
    const { service, stored } = trusting();

    const trusted = await service.trust(WANTED);

    expect(trusted).toEqual({
      pullRequests: { id: 'trust_1', key: 'github-pull-requests' },
      defaultBranch: { id: 'trust_2', key: 'github-apply' },
    });
    expect(stored.get('github-pull-requests')?.workload.subject.value).toBe(
      'repo:acme/platform:pull_request',
    );
    expect(
      stored.get('github-pull-requests')?.scopes.all.map((each) => each.value),
    ).toEqual(['plan']);
    expect(stored.get('github-apply')?.workload.subject.value).toBe(
      'repo:acme/platform:ref:refs/heads/main',
    );
    expect(
      stored
        .get('github-apply')
        ?.scopes.all.map((each) => each.value)
        .sort(),
    ).toEqual(['configure', 'runners', 'secrets']);
  });

  it('keeps the trusts it made before, rather than making them twice', async () => {
    const { service } = trusting();

    const first = await service.trust(WANTED);
    const again = await service.trust(WANTED);

    expect(again).toEqual(first);
  });

  it('points the trusts at another repository when the setup moves', async () => {
    const { service, stored } = trusting();
    await service.trust(WANTED);

    await service.trust({
      ...WANTED,
      repository: 'acme/infra',
      repositoryId: '202',
    });

    expect(stored.get('github-apply')?.workload.subject.value).toBe(
      'repo:acme/infra:ref:refs/heads/main',
    );
  });

  it('refuses to overwrite a trust with the same key that another workload uses', async () => {
    const { service, stored } = trusting();
    await service.trust(WANTED);
    const apply = stored.get('github-apply');
    if (!apply) {
      throw new Error('the setup made no apply trust');
    }
    stored.set(
      'github-apply',
      apply.update(
        {
          key: apply.key,
          workload: WorkloadRule.of({
            issuer: 'https://token.actions.githubusercontent.com',
            audience: 'spotlight',
            subject: 'repo:acme/platform:environment:production',
            claims: {},
          }),
          scopes: apply.scopes,
          lifetime: apply.lifetime,
        },
        ScopeCeiling.of(PersonPrincipal.of(UserId.of('admin_1'))),
        ChangeActor.spotlight(WorkspaceId.of('ws_1')),
      ),
    );

    await expect(service.trust(WANTED)).rejects.toBeInstanceOf(
      TrustKeyTakenError,
    );
    expect(stored.get('github-apply')?.workload.subject.value).toBe(
      'repo:acme/platform:environment:production',
    );
  });

  it('refuses a default branch that a trust cannot name exactly', async () => {
    const { service, stored } = trusting();

    await expect(
      service.trust({ ...WANTED, defaultBranch: 'release/*' }),
    ).rejects.toBeInstanceOf(UnsafeBranchNameError);
    expect(stored.size).toBe(0);
  });

  it('follows the default branch of the repository', async () => {
    const { service, stored } = trusting();

    await service.trust({ ...WANTED, defaultBranch: 'trunk' });

    expect(stored.get('github-apply')?.workload.subject.value).toBe(
      'repo:acme/platform:ref:refs/heads/trunk',
    );
  });

  it('lets only an owner or admin create the trusts', async () => {
    const { service, stored } = trusting(false);

    await expect(service.trust(WANTED)).rejects.toBeInstanceOf(
      TrustsNeedAnAdminError,
    );
    expect(stored.size).toBe(0);
  });

  it('pins both trusts to the repository’s and owner’s ids, and lets an apply token live 60 minutes', async () => {
    const { service, stored } = trusting();

    await service.trust(WANTED);

    for (const key of ['github-pull-requests', 'github-apply']) {
      expect(stored.get(key)?.workload.claims).toEqual({
        repository_id: '101',
        repository_owner_id: '7',
      });
    }
    expect(stored.get('github-apply')?.lifetime.minutes).toBe(60);
    expect(stored.get('github-pull-requests')?.lifetime.minutes).toBe(15);
  });

  it('keeps the scopes and lifetime an admin narrowed when the setup runs again', async () => {
    const { service, stored } = trusting();
    await service.trust(WANTED);
    const apply = stored.get('github-apply');
    if (!apply) {
      throw new Error('the setup made no apply trust');
    }
    stored.set(
      'github-apply',
      apply.update(
        {
          key: apply.key,
          workload: apply.workload,
          scopes: TokenScopes.named(['configure']),
          lifetime: TokenLifetime.ofMinutes(10),
        },
        ScopeCeiling.of(PersonPrincipal.of(UserId.of('admin_1'))),
        ChangeActor.spotlight(WorkspaceId.of('ws_1')),
      ),
    );

    await service.trust({ ...WANTED, defaultBranch: 'trunk' });

    const kept = stored.get('github-apply');
    expect(kept?.workload.subject.value).toBe(
      'repo:acme/platform:ref:refs/heads/trunk',
    );
    expect(kept?.scopes.all.map((each) => each.value)).toEqual(['configure']);
    expect(kept?.lifetime.minutes).toBe(10);
  });
});
