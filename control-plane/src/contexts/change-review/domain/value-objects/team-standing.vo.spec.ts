import { TeamMembershipRequiredError } from '@change-review/domain/exceptions/team-membership-required.error';
import { UnknownReviewError } from '@change-review/domain/exceptions/unknown-review.error';
import { TeamStanding } from '@change-review/domain/value-objects/team-standing.vo';
import { describe, expect, it } from 'vitest';

const unseen = () => new UnknownReviewError('run run_1');

describe('who acts in the reviews of a team’s work', () => {
  it('is someone the team rule admits, on work they see', () => {
    expect(
      TeamStanding.of({ actsOnTeam: true }).actingOn('task_1', unseen),
    ).toBe('task_1');
  });

  it('is nobody who does not see the work, admitted or not: the work is not found', () => {
    expect(() =>
      TeamStanding.of({ actsOnTeam: true }).actingOn(null, unseen),
    ).toThrow(UnknownReviewError);
    expect(() =>
      TeamStanding.of({ actsOnTeam: false }).actingOn(null, unseen),
    ).toThrow(UnknownReviewError);
  });

  it('is not a workspace member outside the team, who still sees the work', () => {
    expect(() =>
      TeamStanding.of({ actsOnTeam: false }).actingOn('task_1', unseen),
    ).toThrow(TeamMembershipRequiredError);
  });

  it('equals a standing with the same admission', () => {
    expect(
      TeamStanding.of({ actsOnTeam: true }).equals(
        TeamStanding.of({ actsOnTeam: true }),
      ),
    ).toBe(true);
    expect(
      TeamStanding.of({ actsOnTeam: true }).equals(
        TeamStanding.of({ actsOnTeam: false }),
      ),
    ).toBe(false);
  });
});
