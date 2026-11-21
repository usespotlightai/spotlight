import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { describe, expect, it } from 'vitest';

const END = new Date('2027-01-01T00:00:00.000Z');

describe('PlanTerm', () => {
  it('gives the plan until it expires, and the free plan from then on', () => {
    const term = PlanTerm.of(Plan.team, END);

    expect(term.at(new Date('2026-12-31T23:59:59.999Z'))).toBe(Plan.team);
    expect(term.at(END)).toBe(Plan.free);
    expect(term.isExpiredAt(END)).toBe(true);
  });

  it('never expires without an end', () => {
    expect(PlanTerm.of(Plan.team).isExpiredAt(new Date(8.64e15))).toBe(false);
  });

  it('is equal to another term with the same plan and end', () => {
    expect(
      PlanTerm.of(Plan.team, END).equals(
        PlanTerm.of(Plan.team, new Date(END.getTime())),
      ),
    ).toBe(true);
    expect(PlanTerm.of(Plan.team, END).equals(PlanTerm.of(Plan.team))).toBe(
      false,
    );
    expect(PlanTerm.of(Plan.team).equals(PlanTerm.of(Plan.enterprise))).toBe(
      false,
    );
  });

  it('drops the end of the free plan, which never ends', () => {
    expect(PlanTerm.of(Plan.free, END)).toBe(PlanTerm.free);
    expect(PlanTerm.of(Plan.free, END).expiresAt).toBeNull();
  });

  it('is free only for the free plan', () => {
    expect(PlanTerm.free.isFree).toBe(true);
    expect(PlanTerm.of(Plan.free).isFree).toBe(true);
    expect(PlanTerm.of(Plan.team).isFree).toBe(false);
    expect(PlanTerm.of(Plan.team, END).isFree).toBe(false);
  });
});
