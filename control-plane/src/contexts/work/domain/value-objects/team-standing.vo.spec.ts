import { TeamMembershipRequiredError } from '@work/domain/exceptions/team-membership-required.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { describe, expect, it } from 'vitest';

const unseen = () => new UnknownTaskError('task-1');

describe('TeamStanding', () => {
  describe('someone the team rule admits: a member, a workspace admin or a token with the scope', () => {
    const standing = TeamStanding.of({ seesTeam: true, actsOnTeam: true });

    it('sees the team’s tasks', () => {
      expect(standing.seesTasks).toBe(true);
    });

    it('acts on the team’s tasks', () => {
      expect(standing.actsOnTasks).toBe(true);
      expect(() => standing.assertActsOnTasks(unseen)).not.toThrow();
    });
  });

  describe('a workspace member outside the team', () => {
    const standing = TeamStanding.of({ seesTeam: true, actsOnTeam: false });

    it('sees the team’s tasks', () => {
      expect(standing.seesTasks).toBe(true);
    });

    it('may not act on them, and is told why', () => {
      expect(standing.actsOnTasks).toBe(false);
      expect(() => standing.assertActsOnTasks(unseen)).toThrow(
        TeamMembershipRequiredError,
      );
    });
  });

  describe('someone outside the workspace', () => {
    const standing = TeamStanding.of({ seesTeam: false, actsOnTeam: false });

    it('neither sees nor acts on the team’s tasks', () => {
      expect(standing.seesTasks).toBe(false);
      expect(standing.actsOnTasks).toBe(false);
    });

    it('is told only that the thing is not there', () => {
      expect(() => standing.assertActsOnTasks(unseen)).toThrow(
        UnknownTaskError,
      );
    });
  });

  it('is equal by its reach', () => {
    expect(
      TeamStanding.of({ seesTeam: true, actsOnTeam: false }).equals(
        TeamStanding.of({ seesTeam: true, actsOnTeam: false }),
      ),
    ).toBe(true);
    expect(
      TeamStanding.of({ seesTeam: true, actsOnTeam: true }).equals(
        TeamStanding.of({ seesTeam: true, actsOnTeam: false }),
      ),
    ).toBe(false);
  });
});
