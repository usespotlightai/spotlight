import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { ConversationAudience } from '@work/domain/services/conversation-audience';
import { describe, expect, it } from 'vitest';

const ANA = UserId.of('user_1');
const BEN = UserId.of('user_2');

describe('ConversationAudience', () => {
  it('stands a person as the assignee before anything else', () => {
    expect(
      ConversationAudience.standingOf(ANA, {
        person: ANA,
        onTeam: true,
        wroteIn: true,
        asked: false,
      }),
    ).toBe('assignee');
  });

  it('stands a member of the team as the team while nobody is the assignee', () => {
    expect(
      ConversationAudience.standingOf(null, {
        person: ANA,
        onTeam: true,
        wroteIn: true,
        asked: false,
      }),
    ).toBe('team');
  });

  it('stands a person who wrote as following once someone else is the assignee', () => {
    expect(
      ConversationAudience.standingOf(BEN, {
        person: ANA,
        onTeam: true,
        wroteIn: true,
        asked: false,
      }),
    ).toBe('following');
  });

  it('shows nothing to a person who neither holds it, is on the team nor wrote in it', () => {
    expect(
      ConversationAudience.standingOf(BEN, {
        person: ANA,
        onTeam: true,
        wroteIn: false,
        asked: false,
      }),
    ).toBeNull();
    expect(
      ConversationAudience.standingOf(null, {
        person: ANA,
        onTeam: false,
        wroteIn: false,
        asked: false,
      }),
    ).toBeNull();
  });

  it('shows nothing to a person off the team who wrote in it while nobody is the assignee', () => {
    expect(
      ConversationAudience.standingOf(null, {
        person: ANA,
        onTeam: false,
        wroteIn: true,
        asked: false,
      }),
    ).toBeNull();
  });

  it('stands the person an open ask names as asked, while someone else is the assignee', () => {
    expect(
      ConversationAudience.standingOf(BEN, {
        person: ANA,
        onTeam: false,
        wroteIn: true,
        asked: true,
      }),
    ).toBe('asked');
    expect(
      ConversationAudience.standingOf(ANA, {
        person: ANA,
        onTeam: true,
        wroteIn: false,
        asked: true,
      }),
    ).toBe('assignee');
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

  it('lets only the assignee and the team resolve without an answer', () => {
    expect(ConversationAudience.resolves('assignee')).toBe(true);
    expect(ConversationAudience.resolves('team')).toBe(true);
    expect(ConversationAudience.resolves('asked')).toBe(false);
    expect(ConversationAudience.resolves('following')).toBe(false);
    expect(ConversationAudience.resolves(null)).toBe(false);
  });

  describe('asksWhileHeld', () => {
    const approval = (open: boolean, askedOf: UserId | null) => ({
      approval: { open, askedOf },
      connectionAsk: null,
    });
    const connection = (met: boolean, personId: UserId) => ({
      approval: null,
      connectionAsk: { met, personId },
    });

    it('asks the person a pending approval or an unmet connection names, while the task is on hold', () => {
      expect(
        ConversationAudience.asksWhileHeld(true, approval(true, ANA), ANA),
      ).toBe(true);
      expect(
        ConversationAudience.asksWhileHeld(true, connection(false, ANA), ANA),
      ).toBe(true);
    });

    it('asks nobody once the approval is decided or the connection is made', () => {
      expect(
        ConversationAudience.asksWhileHeld(true, approval(false, ANA), ANA),
      ).toBe(false);
      expect(
        ConversationAudience.asksWhileHeld(true, connection(true, ANA), ANA),
      ).toBe(false);
    });

    it('asks nobody while the task is not on hold, or when the open conversation asks nothing', () => {
      expect(
        ConversationAudience.asksWhileHeld(false, approval(true, ANA), ANA),
      ).toBe(false);
      expect(ConversationAudience.asksWhileHeld(true, null, ANA)).toBe(false);
      expect(
        ConversationAudience.asksWhileHeld(
          true,
          { approval: null, connectionAsk: null },
          ANA,
        ),
      ).toBe(false);
    });

    it('asks the person an unmet connection names, though the approval on the same note names nobody', () => {
      expect(
        ConversationAudience.asksWhileHeld(
          true,
          {
            approval: { open: true, askedOf: null },
            connectionAsk: { met: false, personId: ANA },
          },
          ANA,
        ),
      ).toBe(true);
    });

    it('asks only the person named', () => {
      expect(
        ConversationAudience.asksWhileHeld(true, approval(true, BEN), ANA),
      ).toBe(false);
      expect(
        ConversationAudience.asksWhileHeld(true, approval(true, null), ANA),
      ).toBe(false);
      expect(
        ConversationAudience.asksWhileHeld(true, connection(false, BEN), ANA),
      ).toBe(false);
    });
  });
});
