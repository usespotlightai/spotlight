import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { ConversationAudience } from '@work/domain/services/conversation-audience';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { describe, expect, it } from 'vitest';

const ANA = UserId.of('user_1');
const BEN = UserId.of('user_2');

describe('ConversationAudience', () => {
  it('stands a person as the assignee before anything else', () => {
    expect(
      ConversationAudience.standingOf(ANA, {
        person: ANA,
        takesTasks: true,
        wroteIn: true,
        asked: false,
      }),
    ).toBe('assignee');
  });

  it('stands a member of the team as the team while nobody is the assignee', () => {
    expect(
      ConversationAudience.standingOf(null, {
        person: ANA,
        takesTasks: true,
        wroteIn: true,
        asked: false,
      }),
    ).toBe('team');
  });

  it('stands a person who wrote as following once someone else is the assignee', () => {
    expect(
      ConversationAudience.standingOf(BEN, {
        person: ANA,
        takesTasks: true,
        wroteIn: true,
        asked: false,
      }),
    ).toBe('following');
  });

  it('shows nothing to a person who neither holds it, is on the team nor wrote in it', () => {
    expect(
      ConversationAudience.standingOf(BEN, {
        person: ANA,
        takesTasks: true,
        wroteIn: false,
        asked: false,
      }),
    ).toBeNull();
    expect(
      ConversationAudience.standingOf(null, {
        person: ANA,
        takesTasks: false,
        wroteIn: false,
        asked: false,
      }),
    ).toBeNull();
  });

  it('shows nothing to a person off the team who wrote in it while nobody is the assignee', () => {
    expect(
      ConversationAudience.standingOf(null, {
        person: ANA,
        takesTasks: false,
        wroteIn: true,
        asked: false,
      }),
    ).toBeNull();
  });

  it('stands the person an open ask names as asked, while someone else is the assignee', () => {
    expect(
      ConversationAudience.standingOf(BEN, {
        person: ANA,
        takesTasks: false,
        wroteIn: true,
        asked: true,
      }),
    ).toBe('asked');
    expect(
      ConversationAudience.standingOf(ANA, {
        person: ANA,
        takesTasks: true,
        wroteIn: false,
        asked: true,
      }),
    ).toBe('assignee');
  });

  it('stands the person an open ask names as the team while nobody is the assignee, so they may resolve it', () => {
    expect(
      ConversationAudience.standingOf(null, {
        person: ANA,
        takesTasks: true,
        wroteIn: false,
        asked: true,
      }),
    ).toBe('team');
    expect(
      ConversationAudience.standingOf(null, {
        person: ANA,
        takesTasks: false,
        wroteIn: false,
        asked: true,
      }),
    ).toBe('asked');
  });

  it('lets only the assignee, the person asked and the team answer', () => {
    expect(ConversationAudience.answers('assignee')).toBe(true);
    expect(ConversationAudience.answers('asked')).toBe(true);
    expect(ConversationAudience.answers('team')).toBe(true);
    expect(ConversationAudience.answers('following')).toBe(false);
    expect(ConversationAudience.answers(null)).toBe(false);
  });

  it('lists runs and resolved conversations to neither the person asked nor the team', () => {
    expect(ConversationAudience.listsRuns('asked')).toBe(false);
    expect(ConversationAudience.listsRuns('team')).toBe(false);
    expect(ConversationAudience.listsResolved('asked')).toBe(false);
  });

  it('tells only the people who answer that something is unread', () => {
    expect(ConversationAudience.notifies('assignee')).toBe(true);
    expect(ConversationAudience.notifies('asked')).toBe(true);
    expect(ConversationAudience.notifies('team')).toBe(true);
    expect(ConversationAudience.notifies('following')).toBe(false);
  });

  it('lets a person who drives a hold answer and resolve, though they stand nowhere', () => {
    const acts = TeamStanding.of({
      seesTeam: true,
      actsOnTeam: true,
      memberOfTeam: true,
    });
    const standing = ConversationAudience.standingOf(BEN, {
      person: ANA,
      takesTasks: true,
      wroteIn: false,
      asked: false,
    });

    expect(standing).toBeNull();
    expect(
      ConversationAudience.mayAnswer(acts, { standing, drives: true }),
    ).toBe(true);
    expect(
      ConversationAudience.mayResolve(acts, { standing, drives: true }),
    ).toBe(true);
    expect(
      ConversationAudience.mayAnswer(acts, { standing, drives: false }),
    ).toBe(false);
  });

  it('lets nobody who only sees the team drive', () => {
    const sees = TeamStanding.of({
      seesTeam: true,
      actsOnTeam: false,
      memberOfTeam: false,
    });

    expect(
      ConversationAudience.mayAnswer(sees, {
        standing: 'following',
        drives: true,
      }),
    ).toBe(false);
    expect(
      ConversationAudience.mayResolve(sees, {
        standing: 'following',
        drives: true,
      }),
    ).toBe(false);
  });

  it('lets only the assignee and the team resolve without an answer', () => {
    expect(ConversationAudience.resolves('assignee')).toBe(true);
    expect(ConversationAudience.resolves('team')).toBe(true);
    expect(ConversationAudience.resolves('asked')).toBe(false);
    expect(ConversationAudience.resolves('following')).toBe(false);
    expect(ConversationAudience.resolves(null)).toBe(false);
  });

  it('lets only a person who acts on the tasks of the team answer, resolve or reopen', () => {
    const acts = TeamStanding.of({
      seesTeam: true,
      actsOnTeam: true,
      memberOfTeam: true,
    });
    const sees = TeamStanding.of({
      seesTeam: true,
      actsOnTeam: false,
      memberOfTeam: false,
    });

    expect(
      ConversationAudience.mayAnswer(acts, {
        standing: 'asked',
        drives: false,
      }),
    ).toBe(true);
    expect(
      ConversationAudience.mayAnswer(sees, {
        standing: 'assignee',
        drives: false,
      }),
    ).toBe(false);
    expect(
      ConversationAudience.mayAnswer(sees, {
        standing: 'asked',
        drives: false,
      }),
    ).toBe(false);
    expect(
      ConversationAudience.mayResolve(acts, {
        standing: 'team',
        drives: false,
      }),
    ).toBe(true);
    expect(
      ConversationAudience.mayResolve(acts, {
        standing: 'asked',
        drives: false,
      }),
    ).toBe(false);
    expect(
      ConversationAudience.mayResolve(sees, {
        standing: 'assignee',
        drives: false,
      }),
    ).toBe(false);
  });

  describe('waitsFor', () => {
    const member = TeamStanding.of({
      seesTeam: true,
      actsOnTeam: true,
      memberOfTeam: true,
    });
    const admin = TeamStanding.of({
      seesTeam: true,
      actsOnTeam: true,
      memberOfTeam: false,
    });
    const onlySees = TeamStanding.of({
      seesTeam: true,
      actsOnTeam: false,
      memberOfTeam: false,
    });
    const askedOfBen = {
      approval: { open: true, askedOf: BEN },
      connectionAsk: null,
    };

    it('waits for the assignee and for no other member of the team', () => {
      expect(
        ConversationAudience.waitsFor(ANA, null, { person: ANA, team: member }),
      ).toBe(true);
      expect(
        ConversationAudience.waitsFor(ANA, null, { person: BEN, team: member }),
      ).toBe(false);
    });

    it('waits for every member of the team while nobody is the assignee', () => {
      expect(
        ConversationAudience.waitsFor(null, null, {
          person: BEN,
          team: member,
        }),
      ).toBe(true);
    });

    it('does not wait for an admin off the team while nobody is the assignee, because answering assigns', () => {
      expect(
        ConversationAudience.waitsFor(null, null, { person: BEN, team: admin }),
      ).toBe(false);
    });

    it('waits for the person an open ask names, though someone else is the assignee', () => {
      expect(
        ConversationAudience.waitsFor(ANA, askedOfBen, {
          person: BEN,
          team: admin,
        }),
      ).toBe(true);
    });

    it('waits for nobody who only sees the team, not even the assignee', () => {
      expect(
        ConversationAudience.waitsFor(ANA, null, {
          person: ANA,
          team: onlySees,
        }),
      ).toBe(false);
    });

    it('waits for nobody who only sees the team, not even a person an open ask names', () => {
      expect(
        ConversationAudience.waitsFor(ANA, askedOfBen, {
          person: BEN,
          team: onlySees,
        }),
      ).toBe(false);
      expect(
        ConversationAudience.waitsFor(null, null, {
          person: BEN,
          team: onlySees,
        }),
      ).toBe(false);
    });

    it('waits for nobody outside the workspace, whatever the task asks', () => {
      const outside = TeamStanding.outside();

      expect(
        ConversationAudience.waitsFor(ANA, null, {
          person: ANA,
          team: outside,
        }),
      ).toBe(false);
      expect(
        ConversationAudience.waitsFor(ANA, askedOfBen, {
          person: BEN,
          team: outside,
        }),
      ).toBe(false);
    });
  });

  describe('asks', () => {
    const approval = (open: boolean, askedOf: UserId | null) => ({
      approval: { open, askedOf },
      connectionAsk: null,
    });
    const connection = (met: boolean, personId: UserId) => ({
      approval: null,
      connectionAsk: { met, personId },
    });

    it('asks the person a pending approval or an unmet connection names', () => {
      expect(ConversationAudience.asks(approval(true, ANA), ANA)).toBe(true);
      expect(ConversationAudience.asks(connection(false, ANA), ANA)).toBe(true);
    });

    it('asks nobody once the approval is decided or the connection is made', () => {
      expect(ConversationAudience.asks(approval(false, ANA), ANA)).toBe(false);
      expect(ConversationAudience.asks(connection(true, ANA), ANA)).toBe(false);
    });

    it('asks nobody when the open conversation asks nothing', () => {
      expect(ConversationAudience.asks(null, ANA)).toBe(false);
      expect(
        ConversationAudience.asks({ approval: null, connectionAsk: null }, ANA),
      ).toBe(false);
    });

    it('asks the person an unmet connection names, though the approval on the same note names nobody', () => {
      expect(
        ConversationAudience.asks(
          {
            approval: { open: true, askedOf: null },
            connectionAsk: { met: false, personId: ANA },
          },
          ANA,
        ),
      ).toBe(true);
    });

    it('asks only the person named', () => {
      expect(ConversationAudience.asks(approval(true, BEN), ANA)).toBe(false);
      expect(ConversationAudience.asks(approval(true, null), ANA)).toBe(false);
      expect(ConversationAudience.asks(connection(false, BEN), ANA)).toBe(
        false,
      );
    });
  });
});

describe('answeredByMessage', () => {
  it('takes a message as the answer, unless what is asked is an approval', () => {
    expect(ConversationAudience.answeredByMessage(null)).toBe(true);
    expect(
      ConversationAudience.answeredByMessage({
        approval: null,
        connectionAsk: null,
      }),
    ).toBe(true);
    expect(
      ConversationAudience.answeredByMessage({
        approval: { open: true, askedOf: null },
        connectionAsk: null,
      }),
    ).toBe(false);
  });
});
