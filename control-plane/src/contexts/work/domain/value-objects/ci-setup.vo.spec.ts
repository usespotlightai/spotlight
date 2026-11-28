import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { AppGrants } from '@work/domain/value-objects/app-grants.vo';
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
        workflows: 'permitted',
      }),
    ).toThrow(InconsistentStateError);
  });

  it('lets the agent push the workflow only when the App may change workflows, or Spotlight could not tell', () => {
    expect(
      CiSetup.workflowsUnder(
        AppGrants.of({ workflows: true, variables: false }),
      ),
    ).toBe('permitted');
    expect(
      CiSetup.workflowsUnder(
        AppGrants.of({ workflows: false, variables: true }),
      ),
    ).toBe('not-permitted');
    expect(CiSetup.workflowsUnder(AppGrants.unread())).toBe('permitted');
  });
});
