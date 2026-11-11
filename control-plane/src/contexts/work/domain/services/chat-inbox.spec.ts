import {
  chatInboxStanding,
  chatProgress,
  chatRunning,
  chatUnread,
} from '@work/domain/services/chat-inbox';
import { describe, expect, it } from 'vitest';

const EARLIER = new Date('2026-11-11T09:00:00.000Z');
const LATER = new Date('2026-11-11T10:00:00.000Z');

const IDLE = { hasCurrentRun: false, waiting: false };
const WORKING = { hasCurrentRun: true, waiting: false };
const WAITING = { hasCurrentRun: false, waiting: true };

describe('chat inbox', () => {
  it('is running while a run works and while a message waits for one', () => {
    expect(chatRunning(WORKING)).toBe(true);
    expect(chatRunning(WAITING)).toBe(true);
    expect(chatRunning(IDLE)).toBe(false);
  });

  it('is unread only while a proposal is newer than the read marker', () => {
    expect(chatUnread({ readAt: null, lastProposedAt: null })).toBe(false);
    expect(chatUnread({ readAt: null, lastProposedAt: EARLIER })).toBe(true);
    expect(chatUnread({ readAt: EARLIER, lastProposedAt: LATER })).toBe(true);
    expect(chatUnread({ readAt: LATER, lastProposedAt: EARLIER })).toBe(false);
    expect(chatUnread({ readAt: LATER, lastProposedAt: LATER })).toBe(false);
  });

  it('counts as resolved only once nothing runs for it any more', () => {
    const facts = { readAt: null, lastProposedAt: null, resolvedAt: LATER };

    expect(chatInboxStanding({ ...facts, ...IDLE })).toEqual({
      unread: false,
      resolved: true,
      running: false,
    });
    expect(chatInboxStanding({ ...facts, ...WAITING })).toEqual({
      unread: false,
      resolved: false,
      running: true,
    });
  });

  it('has no progress while idle, is queued while a message waits for a run, and follows the current run', () => {
    const suspended = { progress: null, resumable: true };
    const working = { progress: 'in-progress' as const, resumable: false };

    expect(chatProgress(IDLE, working)).toBeNull();
    expect(chatProgress(WAITING, null)).toBe('queued');
    expect(chatProgress(WORKING, null)).toBe('queued');
    expect(chatProgress(WORKING, working)).toBe('in-progress');
    expect(chatProgress(WORKING, suspended)).toBeNull();
    expect(
      chatProgress({ hasCurrentRun: true, waiting: true }, suspended),
    ).toBe('queued');
  });
});
