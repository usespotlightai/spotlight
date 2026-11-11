import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { CiSetup } from '@work/domain/value-objects/ci-setup.vo';
import { describe, expect, it } from 'vitest';

describe('CiSetup', () => {
  it('lets CI apply configuration, secrets and runners, and nothing more', () => {
    expect(CiSetup.APPLY_SCOPES).toEqual(['configure', 'secrets', 'runners']);
  });

  it('names the repository variables the workflow reads', () => {
    expect(CiSetup.VARIABLES).toEqual({
      url: 'SPOTLIGHT_URL',
      planTrust: 'SPOTLIGHT_PLAN_TRUST',
      applyTrust: 'SPOTLIGHT_APPLY_TRUST',
    });
  });

  it('refuses a setup without a trust', () => {
    expect(() =>
      CiSetup.of({
        defaultBranch: 'main',
        defaultBranchProtected: true,
        pullRequestsTrustId: '',
        defaultBranchTrustId: 'trust_2',
        variables: 'written',
      }),
    ).toThrow(InconsistentStateError);
  });
});
