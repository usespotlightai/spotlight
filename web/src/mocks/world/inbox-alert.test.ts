import { afterEach, describe, expect, it, vi } from 'vitest';

const firedAt = async (now: string) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(now));
  vi.resetModules();

  const { ALERT_RISES_BY, alertFiring } = await import(
    '@/mocks/world/inbox-alert'
  );
  const firing = alertFiring();

  return {
    risesBy: ALERT_RISES_BY,
    change: firing ? firing.value - (firing.baseline ?? 0) : null,
  };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('the seeded sent-back alert', () => {
  it('rises by the same amount whatever the time of day the mock is built', async () => {
    const at = [
      '2026-10-10T01:00:00Z',
      '2026-10-10T07:00:00Z',
      '2026-10-10T13:00:00Z',
      '2026-10-10T23:30:00Z',
      '2026-11-03T12:00:00Z',
    ];
    const changes: (number | null)[] = [];

    for (const now of at) {
      const { risesBy, change } = await firedAt(now);

      expect(change).toBeGreaterThanOrEqual(risesBy - 1e-9);
      changes.push(change);
    }

    expect(new Set(changes).size).toBe(1);
  });
});
