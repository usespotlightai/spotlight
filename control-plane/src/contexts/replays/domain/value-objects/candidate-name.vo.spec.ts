import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { describe, expect, it } from 'vitest';

describe('CandidateName', () => {
  it('names one candidate whatever the case it is written in', () => {
    const planned = CandidateName.planned('Faster build', new Date(0));

    expect(planned.is('planned change, faster build')).toBe(true);
    expect(
      planned.equals(CandidateName.rehydrate('PLANNED CHANGE, FASTER BUILD')),
    ).toBe(true);
    expect(planned.is('Planned change, slower build')).toBe(false);
  });
});
