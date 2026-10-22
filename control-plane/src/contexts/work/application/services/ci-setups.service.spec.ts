import type { RepositorySettingsPort } from '@github/application/ports/repository-settings.port';
import type { GitHubActionsTrustsPort } from '@identity/application/ports/github-actions-trusts.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { CiSetups } from '@work/application/services/ci-setups.service';
import { describe, expect, it, vi } from 'vitest';

const settingUp = (variables: 'written' | 'not-permitted' = 'written') => {
  const settings = {
    defaultBranchOf: vi.fn(async () => ({ name: 'trunk', protected: false })),
    putVariables: vi.fn(async () => variables),
  } satisfies RepositorySettingsPort;
  const trusts = {
    trust: vi.fn(async () => ({
      pullRequests: { id: 'trust_plan', key: 'github-pull-requests' },
      defaultBranch: { id: 'trust_apply', key: 'github-apply' },
    })),
  } satisfies GitHubActionsTrustsPort;

  return {
    settings,
    trusts,
    ci: new CiSetups(settings, trusts, 'https://app.usespotlight.ai'),
  };
};

const setUp = (ci: CiSetups) =>
  ci.setUp(
    WorkspaceId.of('ws_1'),
    UserId.of('admin_1'),
    Repository.of('acme/infra'),
  );

describe('CiSetups', () => {
  it('trusts the repository on its default branch, as the person who sets it up', async () => {
    const { ci, trusts } = settingUp();

    await setUp(ci);

    expect(trusts.trust).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      by: 'admin_1',
      client: 'web',
      repository: 'acme/infra',
      defaultBranch: 'trunk',
      applyScopes: ['configure', 'secrets', 'runners'],
    });
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
});
