import { decidesFrom } from '@change-review/domain/services/decision-policy';
import { describe, expect, it } from 'vitest';

const RECORDS = { decisions: true };
const KEEPS = { reviewing: false };

describe('decidesFrom', () => {
  it('decides from a run or a turn that hands the work over to people', () => {
    expect(decidesFrom(RECORDS, true, KEEPS)).toBe(true);
  });

  it('decides nothing from a run or a turn that hands nothing over', () => {
    expect(decidesFrom(RECORDS, false, KEEPS)).toBe(false);
  });

  it.each([
    ['its station records none', { decisions: false }, KEEPS],
    [
      'the task reviews a pull request opened elsewhere',
      RECORDS,
      { reviewing: true },
    ],
  ])('decides nothing where %s', (_, run, task) => {
    expect(decidesFrom(run, true, task)).toBe(false);
  });
});
