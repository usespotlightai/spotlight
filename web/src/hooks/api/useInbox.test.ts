import { describe, expect, it } from 'vitest';
import { openedJustNow, pollEvery } from '@/hooks/api/useInbox';
import type { InboxItem } from '@/lib/inbox';

const AT = Date.parse('2026-10-02T16:07:00.000Z');
const ITEM = { title: 'Set up your team' } as InboxItem;

describe('pollEvery', () => {
  it('polls every ten seconds for a workspace not created in this tab', () => {
    expect(pollEvery('elsewhere', [], AT)).toBe(10_000);
  });

  it('polls every second while a just created workspace has an empty inbox', () => {
    openedJustNow('waiting', AT);

    expect(pollEvery('waiting', undefined, AT)).toBe(1_000);
    expect(pollEvery('waiting', [], AT + 14_000)).toBe(1_000);
  });

  it('slows down once the setup item shows, and stays slow', () => {
    openedJustNow('welcomed', AT);

    expect(pollEvery('welcomed', [ITEM], AT + 2_000)).toBe(10_000);
    expect(pollEvery('welcomed', [], AT + 3_000)).toBe(10_000);
  });

  it('gives up polling quickly after fifteen seconds', () => {
    openedJustNow('slow', AT);

    expect(pollEvery('slow', [], AT + 15_000)).toBe(10_000);
    expect(pollEvery('slow', [], AT + 16_000)).toBe(10_000);
  });
});
