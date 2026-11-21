import { InvalidPlanError } from '@catalog/domain/exceptions/invalid-plan.error';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { describe, expect, it } from 'vitest';

describe('Plan', () => {
  it.each(['free', 'team', 'enterprise'])('names the %s plan', (raw) => {
    expect(Plan.of(raw).value).toBe(raw);
    expect(Plan.rehydrate(raw).value).toBe(raw);
  });

  it('refuses a plan that does not exist, and names the plans that do', () => {
    expect(() => Plan.of('gold')).toThrow(InvalidPlanError);
    expect(() => Plan.of('Team')).toThrow(
      'Plan Team does not exist. Valid plans: free, team, enterprise.',
    );
  });

  it('finds a stored plan that does not exist inconsistent, not invalid', () => {
    expect(() => Plan.rehydrate('gold')).toThrow(InconsistentStateError);
  });

  it('includes every plan below it', () => {
    expect(Plan.enterprise.includes(Plan.team)).toBe(true);
    expect(Plan.team.includes(Plan.team)).toBe(true);
    expect(Plan.free.includes(Plan.team)).toBe(false);
  });
});
