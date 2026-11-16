import { candidateOf } from '@replays/domain/replays.fake-spec';
import { judgingRequestOf } from '@replays/domain/services/judging-request';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { describe, expect, it } from 'vitest';

describe('judgingRequestOf', () => {
  it('fails with an unreadable rubric when the candidate is gone or has no judge', () => {
    expect(judgingRequestOf(null)).toEqual({
      judged: false,
      failure: 'unreadable-rubric',
    });
    expect(judgingRequestOf(candidateOf('searched'))).toEqual({
      judged: false,
      failure: 'unreadable-rubric',
    });
  });

  it('asks the candidate’s judge on behalf of its team', () => {
    const judged = candidateOf(
      'searched',
      'candidate_judged',
      JudgeCriteria.of({ claims: ['It is terse.'] }),
    );

    expect(judgingRequestOf(judged)).toEqual({
      judged: true,
      teamId: judged.teamId,
      criteria: judged.judge,
    });
  });
});
