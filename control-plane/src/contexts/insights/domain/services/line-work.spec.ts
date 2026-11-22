import { asksAPerson, isLineWork } from '@insights/domain/services/line-work';
import { describe, expect, it } from 'vitest';

describe('the work of a line', () => {
  it('counts a run the line drove, not a turn a person drove', () => {
    expect(isLineWork({ drivenByAPerson: false })).toBe(true);
    expect(isLineWork({ drivenByAPerson: true })).toBe(false);
  });

  it('counts a question the line put to a person as asking, not a failure it reported', () => {
    expect(asksAPerson({ drivenByAPerson: false, runAsked: true })).toBe(true);
    expect(asksAPerson({ drivenByAPerson: false, runAsked: false })).toBe(
      false,
    );
    expect(asksAPerson({ drivenByAPerson: true, runAsked: true })).toBe(false);
  });
});
