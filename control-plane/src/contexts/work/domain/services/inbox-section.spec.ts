import { inboxSectionOf } from '@work/domain/services/inbox-section';
import { describe, expect, it } from 'vitest';

const entry = (shown: Partial<Parameters<typeof inboxSectionOf>[0]>) =>
  inboxSectionOf({ unread: false, resolved: false, running: false, ...shown });

describe('the inbox section of an entry', () => {
  it('keeps an unread entry open, also when it runs or is resolved', () => {
    expect(entry({ unread: true, running: true })).toBe('open');
    expect(entry({ unread: true, resolved: true })).toBe('open');
  });

  it('puts a read, resolved entry under resolved', () => {
    expect(entry({ resolved: true, running: true })).toBe('resolved');
  });

  it('puts a read entry that runs under running', () => {
    expect(entry({ running: true })).toBe('running');
  });

  it('keeps any other entry open', () => {
    expect(entry({})).toBe('open');
  });
});
