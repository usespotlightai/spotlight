import { TrustKeyTakenError } from '@identity/domain/exceptions/trust-key-taken.error';
import { UnsafeBranchNameError } from '@identity/domain/exceptions/unsafe-branch-name.error';
import { UnsupportedSubjectPrefixError } from '@identity/domain/exceptions/unsupported-subject-prefix.error';
import { GitHubActionsTrustTemplate } from '@identity/domain/services/github-actions-trust-template';
import { oidcTrustKeyed } from '@identity/testing/identity.resources.fake-spec';
import { describe, expect, it } from 'vitest';

const REPOSITORY = {
  subjectPrefix: 'repo:acme/platform',
  repositoryId: '101',
  ownerId: '7',
  defaultBranch: 'main',
  applyScopes: ['configure'],
};

describe('GitHubActionsTrustTemplate', () => {
  it('trusts pull requests to plan and the default branch to apply, pinned to the repository', () => {
    const { pullRequests, defaultBranch } =
      GitHubActionsTrustTemplate.specsFor(REPOSITORY);

    expect(pullRequests.workload.subject.value).toBe(
      'repo:acme/platform:pull_request',
    );
    expect(defaultBranch.workload.subject.value).toBe(
      'repo:acme/platform:ref:refs/heads/main',
    );
    expect(defaultBranch.workload.claims).toEqual({
      repository_id: '101',
      repository_owner_id: '7',
    });
  });

  it('names only a branch and a subject form a trust can match exactly', () => {
    expect(() =>
      GitHubActionsTrustTemplate.specsFor({
        ...REPOSITORY,
        defaultBranch: 'rel*',
      }),
    ).toThrow(UnsafeBranchNameError);
    expect(() =>
      GitHubActionsTrustTemplate.specsFor({
        ...REPOSITORY,
        subjectPrefix: 'repo:acme/*',
      }),
    ).toThrow(UnsupportedSubjectPrefixError);
  });

  it('takes over no trust that setup did not make', () => {
    const { defaultBranch } = GitHubActionsTrustTemplate.specsFor(REPOSITORY);

    expect(() =>
      GitHubActionsTrustTemplate.adopted(
        oidcTrustKeyed('github-apply', 'repo:acme/*'),
        defaultBranch,
      ),
    ).toThrow(TrustKeyTakenError);
  });
});
