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
        drives: false,
      }),
    ).toBe('assignee');
  });

  it('stands a member of the team as the team while nobody is the assignee', () => {
    expect(
      ConversationAudience.standingOf(null, {
        person: ANA,
        onTeam: true,
        wroteIn: true,
        drives: false,
      }),
    ).toBe('team');
  });

  it('stands a person who wrote as following once someone else is the assignee', () => {
    expect(
      ConversationAudience.standingOf(BEN, {
        person: ANA,
        onTeam: true,
        wroteIn: true,
        drives: false,
      }),
    ).toBe('following');
  });

  it('shows nothing to a person who neither holds it, is on the team nor wrote in it', () => {
    expect(
      ConversationAudience.standingOf(BEN, {
        person: ANA,
        onTeam: true,
        wroteIn: false,
        drives: false,
      }),
    ).toBeNull();
    expect(
      ConversationAudience.standingOf(null, {
        person: ANA,
        onTeam: false,
        wroteIn: false,
        drives: false,
      }),
    ).toBeNull();
  });

  it('shows nothing to a person off the team who wrote in it while nobody is the assignee', () => {
    expect(
      ConversationAudience.standingOf(null, {
        person: ANA,
        onTeam: false,
        wroteIn: true,
        drives: false,
      }),
    ).toBeNull();
  });

  it('lets only the assignee and the team answer', () => {
    expect(ConversationAudience.answers('assignee')).toBe(true);
    expect(ConversationAudience.answers('team')).toBe(true);
    expect(ConversationAudience.answers('following')).toBe(false);
    expect(ConversationAudience.answers(null)).toBe(false);
  });

  it('tells only the people who answer that something is unread', () => {
    expect(ConversationAudience.notifies('assignee')).toBe(true);
    expect(ConversationAudience.notifies('team')).toBe(true);
    expect(ConversationAudience.notifies('following')).toBe(false);
  });

  it('stands a person who drives a hold as following, and lets them act on it', () => {
    const standing = ConversationAudience.standingOf(BEN, {
      person: ANA,
      onTeam: true,
      wroteIn: false,
      drives: true,
    });

    expect(standing).toBe('following');
    expect(ConversationAudience.answers(standing)).toBe(false);
    expect(
      ConversationAudience.actsOn(standing, {
        actsOnTasks: true,
        drives: true,
      }),
    ).toBe(true);
    expect(
      ConversationAudience.actsOn(standing, {
        actsOnTasks: true,
        drives: false,
      }),
    ).toBe(false);
  });

  it('lets nobody who only sees the team act, whatever their standing', () => {
    expect(
      ConversationAudience.actsOn('assignee', {
        actsOnTasks: false,
        drives: false,
      }),
    ).toBe(false);
    expect(
      ConversationAudience.actsOn('team', { actsOnTasks: false, drives: true }),
    ).toBe(false);
    expect(
      ConversationAudience.actsOn('assignee', {
        actsOnTasks: true,
        drives: false,
      }),
    ).toBe(true);
  });
});
