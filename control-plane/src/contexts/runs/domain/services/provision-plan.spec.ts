import { ProvisionPlan } from '@runs/domain/services/provision-plan';
import { describe, expect, it } from 'vitest';

describe('ProvisionPlan', () => {
  it('is done once a pool provisions', () => {
    expect(ProvisionPlan.after('provisioned', false)).toBe('done');
  });

  it('records a failure only on the last fitting pool', () => {
    expect(ProvisionPlan.after('failed', true)).toBe('record-failure');
    expect(ProvisionPlan.after('failed', false)).toBe('try-another-pool');
  });

  it('tries another pool when one is full or gone, never counting it', () => {
    for (const outcome of ['full', 'gone'] as const) {
      expect(ProvisionPlan.after(outcome, true)).toBe('try-another-pool');
    }
  });
});
