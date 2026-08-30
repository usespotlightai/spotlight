import { anyUnread, unread } from '@domain/services/unread';
import { describe, expect, it } from 'vitest';

const at = new Date('2026-08-30T09:00:00.000Z');

describe('unread', () => {
  it('is what was asked and not yet read', () => {
    expect(unread({ kind: 'asked', readAt: null })).toBe(true);
  });

  it('is not what has been read', () => {
    expect(unread({ kind: 'asked', readAt: at })).toBe(false);
  });

  // A station being told something is not a person being asked something.
  it('is nothing a station was told, read or not', () => {
    expect(unread({ kind: 'passed', readAt: null })).toBe(false);
    expect(unread({ kind: 'answered', readAt: null })).toBe(false);
  });

  it('holds for a conversation while anything asked in it is unread', () => {
    expect(
      anyUnread([
        { kind: 'asked', readAt: at },
        { kind: 'answered', readAt: null },
        { kind: 'asked', readAt: null },
      ]),
    ).toBe(true);
  });

  it('does not hold once every ask has been read', () => {
    expect(
      anyUnread([
        { kind: 'asked', readAt: at },
        { kind: 'answered', readAt: null },
      ]),
    ).toBe(false);
  });
});
