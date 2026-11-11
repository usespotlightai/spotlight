import { SetupAdmission } from '@work/domain/services/setup-admission';
import { describe, expect, it } from 'vitest';

describe('SetupAdmission', () => {
  it('is ready once code is reachable and a runner can reach out through egress', () => {
    expect(
      SetupAdmission.readyIn({ codeReachable: true, egressAvailable: true }),
    ).toBe(true);
    expect(
      SetupAdmission.readyIn({ codeReachable: false, egressAvailable: true }),
    ).toBe(false);
    expect(
      SetupAdmission.readyIn({ codeReachable: true, egressAvailable: false }),
    ).toBe(false);
  });

  it('refuses a person who is no admin before anything else, with the same rule the query shows', () => {
    expect(
      SetupAdmission.refusalOf({
        requesterIsAdmin: false,
        codeReachable: false,
        egressAvailable: false,
      }),
    ).toBe('needs-an-admin');
    expect(
      SetupAdmission.refusalOf({
        requesterIsAdmin: true,
        codeReachable: true,
        egressAvailable: false,
      }),
    ).toBe('needs-egress');
    expect(
      SetupAdmission.refusalOf({
        requesterIsAdmin: true,
        codeReachable: true,
        egressAvailable: true,
      }),
    ).toBeNull();
  });
});
