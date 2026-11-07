import { takesUpRun } from '@work/domain/services/taking-up';
import { describe, expect, it } from 'vitest';

describe('takesUpRun', () => {
  it("takes up the task's current run once nobody owes an answer", () => {
    expect(takesUpRun({ holdsRun: true, awaitsAPerson: false })).toBe(true);
  });

  it('takes up no run while a person owes an answer, nor a run the task left', () => {
    expect(takesUpRun({ holdsRun: true, awaitsAPerson: true })).toBe(false);
    expect(takesUpRun({ holdsRun: false, awaitsAPerson: false })).toBe(false);
  });
});
