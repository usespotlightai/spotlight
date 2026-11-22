import { TeamMembershipRequiredError } from '@work/domain/exceptions/team-membership-required.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { describe, expect, it } from 'vitest';

const unseen = () => new UnknownTaskError('task-1');

describe('TeamStanding', () => {
  describe('a person on the team', () => {
    const standing = TeamStanding.of({
      seesTeam: true,
      actsOnTeam: true,
      memberOfTeam: true,
    });

    it('sees and acts on the team’s tasks', () => {
      expect(standing.seesTasks).toBe(true);
      expect(standing.actsOnTasks).toBe(true);
      expect(() => standing.assertActsOnTasks(unseen)).not.toThrow();
    });

    it('takes the team’s tasks, so a question nobody holds is theirs to answer', () => {
      expect(standing.takesTasks).toBe(true);
    });
  });

  describe('a workspace admin or a token the team rule admits, not on the team', () => {
    const standing = TeamStanding.of({
      seesTeam: true,
      actsOnTeam: true,
      memberOfTeam: false,
    });

    it('acts on the team’s tasks', () => {
      expect(standing.actsOnTasks).toBe(true);
      expect(() => standing.assertActsOnTasks(unseen)).not.toThrow();
    });

    it('does not take them, because only a member can be assigned', () => {
      expect(standing.takesTasks).toBe(false);
    });
  });

  describe('a workspace member outside the team', () => {
    const standing = TeamStanding.of({
      seesTeam: true,
      actsOnTeam: false,
      memberOfTeam: false,
    });

    it('sees the team’s tasks', () => {
      expect(standing.seesTasks).toBe(true);
    });

    it('may not act on them, and is told why', () => {
      expect(standing.actsOnTasks).toBe(false);
      expect(standing.takesTasks).toBe(false);
      expect(() => standing.assertActsOnTasks(unseen)).toThrow(
        TeamMembershipRequiredError,
      );
    });
  });

  describe('someone outside the workspace', () => {
    const standing = TeamStanding.of({
      seesTeam: false,
      actsOnTeam: false,
      memberOfTeam: false,
    });

    it('neither sees nor acts on the team’s tasks', () => {
      expect(standing.seesTasks).toBe(false);
      expect(standing.actsOnTasks).toBe(false);
      expect(standing.takesTasks).toBe(false);
    });

    it('is told only that the thing is not there', () => {
      expect(() => standing.assertActsOnTasks(unseen)).toThrow(
        UnknownTaskError,
      );
    });
  });

  it('is equal by its reach', () => {
    const admin = { seesTeam: true, actsOnTeam: true, memberOfTeam: false };

    expect(TeamStanding.of(admin).equals(TeamStanding.of(admin))).toBe(true);
    expect(
      TeamStanding.of({ ...admin, memberOfTeam: true }).equals(
        TeamStanding.of(admin),
      ),
    ).toBe(false);
  });
});
