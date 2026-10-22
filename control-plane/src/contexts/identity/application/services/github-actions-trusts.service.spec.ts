import { TrustsNeedAnAdminError } from '@identity/application/errors/trusts-need-an-admin.error';
import type {
  WorkspaceAccessPort,
  WorkspacePermissions,
} from '@identity/application/ports/workspace-access.port';
import { GitHubActionsTrusts } from '@identity/application/services/github-actions-trusts.service';
import type { OidcTrust } from '@identity/domain/aggregates/oidc-trust.aggregate';
import type { OidcTrustRepository } from '@identity/domain/repositories/oidc-trust.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WANTED = {
  workspaceId: 'ws_1',
  by: 'admin_1',
  client: 'web',
  repository: 'acme/platform',
  defaultBranch: 'main',
  applyScopes: ['configure', 'secrets', 'runners'],
};

const permissions = (managesOidcTrusts: boolean): WorkspacePermissions => ({
  workspaceId: WorkspaceId.of('ws_1'),
  slug: 'acme',
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

    await service.trust({ ...WANTED, repository: 'acme/infra' });

    expect(stored.get('github-apply')?.workload.subject.value).toBe(
      'repo:acme/infra:ref:refs/heads/main',
    );
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
});
