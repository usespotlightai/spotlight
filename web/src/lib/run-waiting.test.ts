import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatDate } from '@/lib/date-format';
import { offlineWordsOf, quietHostsOf } from '@/lib/run-waiting';

const SINCE = '2026-11-27T20:00:00.000Z';

describe('quietHostsOf', () => {
  it('names the offline hosts only for a run that waits for them', () => {
    const quiet = { hosts: ['dev-host'], since: SINCE };

    expect(quietHostsOf({ reason: 'hosts-offline', since: SINCE, quiet })).toBe(
      quiet,
    );
    expect(
      quietHostsOf({ reason: 'hosts-pull', since: SINCE, quiet: null }),
    ).toBeNull();
    expect(quietHostsOf(null)).toBeNull();
  });
});

describe('offlineWordsOf', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('names the only offline host, and the time it went quiet today', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T20:30:00.000Z'));

    expect(offlineWordsOf({ hosts: ['dev-host'], since: SINCE }, 'chat')).toBe(
      `Queued: dev-host, the only host that can take this chat, has been offline since ${formatDate(new Date(SINCE), { hour: '2-digit', minute: '2-digit' })}.`,
    );
  });

  it('counts several hosts, and dates an outage of an earlier day by its day', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-29T09:00:00.000Z'));

    expect(
      offlineWordsOf({ hosts: ['dev-host', 'ci-host'], since: SINCE }, 'run'),
    ).toBe(
      `Queued: the 2 hosts that can take this run have been offline since ${formatDate(new Date(SINCE), { month: 'short', day: 'numeric' })}.`,
    );
  });

  it('says no host is online when none is left to hear from', () => {
    expect(offlineWordsOf({ hosts: [], since: null }, 'run')).toBe(
      'Queued: no host that can take this run is online.',
    );
  });
});
