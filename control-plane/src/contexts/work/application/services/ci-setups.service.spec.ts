import type {
  InstallationPermissionsDto,
  InstallationPermissionsPort,
} from '@github/application/ports/installation-permissions.port';
import type { RepositorySettingsPort } from '@github/application/ports/repository-settings.port';
import type { GitHubActionsTrustsPort } from '@identity/application/ports/github-actions-trusts.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { CiSetups } from '@work/application/services/ci-setups.service';
import { describe, expect, it, vi } from 'vitest';

const settingUp = (
  variables: 'written' | 'not-permitted' = 'written',
  granted: InstallationPermissionsDto | null = {
    workflows: true,
    variables: true,
  },
) => {
  const settings = {
    defaultBranchOf: vi.fn(async () => ({
      name: 'trunk',
      protected: false,
      repositoryId: '101',
      ownerId: '7',
    })),
    defaultBranchNameOf: vi.fn(async () => 'trunk'),
    oidcSubjectPrefixOf: vi.fn(async () => 'repo:acme@7/infra@101'),
    visibilityOf: vi.fn(async () => 'public' as const),
    putVariables: vi.fn(async () => variables),
  } satisfies RepositorySettingsPort;
  const trusts = {
    trust: vi.fn(async () => ({
      pullRequests: { id: 'trust_plan', key: 'github-pull-requests' },
      defaultBranch: { id: 'trust_apply', key: 'github-apply' },
    })),
  } satisfies GitHubActionsTrustsPort;
  const permissions = {
    of: vi.fn(async () => granted),
  } satisfies InstallationPermissionsPort;

  return {
    settings,
    trusts,
    permissions,
    ci: new CiSetups(
      settings,
      trusts,
      permissions,
      'https://app.usespotlight.ai',
    ),
  };
};

const setUp = (ci: CiSetups) =>
  ci.setUp(
    WorkspaceId.of('ws_1'),
    UserId.of('admin_1'),
    Repository.of('acme/infra'),
  );

describe('CiSetups', () => {
  it('trusts the repository by its OIDC subject prefix and default branch, as the person who sets it up', async () => {
    const { ci, trusts } = settingUp();

    await setUp(ci);

    expect(trusts.trust).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      by: 'admin_1',
      client: 'web',
      subjectPrefix: 'repo:acme@7/infra@101',
      repositoryId: '101',
      ownerId: '7',
      defaultBranch: 'trunk',
      applyScopes: ['configure', 'secrets', 'runners'],
    });
  });

  it('stops, and trusts nothing, when GitHub will not give the subject prefix', async () => {
    const { ci, settings, trusts } = settingUp();
    settings.oidcSubjectPrefixOf.mockRejectedValueOnce(
      new Error('GitHub would not return the OIDC subject settings'),
    );

    await expect(setUp(ci)).rejects.toThrow(
      'GitHub would not return the OIDC subject settings',
    );
    expect(trusts.trust).not.toHaveBeenCalled();
    expect(settings.putVariables).not.toHaveBeenCalled();
  });

  it('writes the address and both trusts into the repository’s variables', async () => {
    const { ci, settings } = settingUp();

    await setUp(ci);

    expect(settings.putVariables).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      Repository.of('acme/infra'),
      {
        SPOTLIGHT_URL: 'https://app.usespotlight.ai',
        SPOTLIGHT_PLAN_TRUST: 'trust_plan',
        SPOTLIGHT_APPLY_TRUST: 'trust_apply',
      },
    );
  });

  it('records what it set up, and whether the default branch is protected', async () => {
    const { ci } = settingUp('not-permitted');

    const set = await setUp(ci);

    expect(set).toMatchObject({
      defaultBranch: 'trunk',
      defaultBranchProtected: false,
      pullRequestsTrustId: 'trust_plan',
      defaultBranchTrustId: 'trust_apply',
      variables: 'not-permitted',
    });
  });

  it('records that the agent may add the workflow when the GitHub App may change workflows', async () => {
    const { ci, permissions } = settingUp();

    const set = await setUp(ci);

    expect(set.workflows).toBe('permitted');
    expect(permissions.of).toHaveBeenCalledWith(WorkspaceId.of('ws_1'));
  });

  it('records that the agent may not add the workflow when the GitHub App may not change workflows', async () => {
    const { ci } = settingUp('written', { workflows: false, variables: true });

    expect((await setUp(ci)).workflows).toBe('not-permitted');
  });

  it('lets the agent try the workflow when GitHub would not say what the App may do', async () => {
    const { ci } = settingUp('written', null);

    expect((await setUp(ci)).workflows).toBe('permitted');
  });
});
