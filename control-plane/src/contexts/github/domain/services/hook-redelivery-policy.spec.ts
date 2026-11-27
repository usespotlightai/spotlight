import {
  HOOK_DELIVERY_LOOKBACK_MS,
  type HookDeliveryHistory,
  MAX_REDELIVERIES,
  outcomeOf,
  redeliveryDue,
} from '@github/domain/services/hook-redelivery-policy';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-26T12:00:00Z');

const ago = (ms: number) => new Date(NOW.getTime() - ms);

const MINUTE_MS = 60_000;

const HOUR = 60 * MINUTE_MS;

const history = (
  over: Partial<HookDeliveryHistory> = {},
): HookDeliveryHistory => ({
  firstAt: ago(10 * MINUTE_MS),
  lastAt: ago(10 * MINUTE_MS),
  lastOutcome: 'transient',
  attempts: 1,
  requests: 0,
  requestedAt: null,
  ...over,
});

describe('hook redelivery policy', () => {
  it.each([
    [200, 'delivered'],
    [202, 'delivered'],
    [500, 'transient'],
    [502, 'transient'],
    [530, 'transient'],
    [408, 'transient'],
    [429, 'transient'],
    [0, 'transient'],
    [null, 'transient'],
    [401, 'refused'],
    [404, 'refused'],
  ] as const)('calls an answer of %s %s', (statusCode, outcome) => {
    expect(outcomeOf(statusCode)).toBe(outcome);
  });

  it('asks again a minute after a delivery failed', () => {
    expect(redeliveryDue(history({ lastAt: ago(59_000) }), NOW)).toBe(false);
    expect(redeliveryDue(history({ lastAt: ago(MINUTE_MS) }), NOW)).toBe(true);
  });

  it('waits twice as long after each redelivery, an hour at most', () => {
    const third = history({ attempts: 3, lastAt: ago(3 * MINUTE_MS) });
    const late = history({ attempts: 9, lastAt: ago(60 * MINUTE_MS) });

    expect(redeliveryDue(third, NOW)).toBe(false);
    expect(redeliveryDue({ ...third, lastAt: ago(4 * MINUTE_MS) }, NOW)).toBe(
      true,
    );
    expect(redeliveryDue(late, NOW)).toBe(true);
  });

  it('waits from the last request while its attempt is not listed yet', () => {
    expect(
      redeliveryDue(history({ requests: 1, requestedAt: ago(MINUTE_MS) }), NOW),
    ).toBe(false);
  });

  it('stops after the last redelivery', () => {
    expect(
      redeliveryDue(
        history({ attempts: MAX_REDELIVERIES + 1, lastAt: ago(HOUR) }),
        NOW,
      ),
    ).toBe(false);
    expect(
      redeliveryDue(
        history({ requests: MAX_REDELIVERIES, requestedAt: ago(HOUR) }),
        NOW,
      ),
    ).toBe(false);
  });

  it('does not ask again for what Spotlight refused', () => {
    expect(redeliveryDue(history({ lastOutcome: 'refused' }), NOW)).toBe(false);
  });

  it('does not ask for a delivery that GitHub no longer keeps', () => {
    expect(
      redeliveryDue(
        history({ firstAt: ago(HOOK_DELIVERY_LOOKBACK_MS + 1) }),
        NOW,
      ),
    ).toBe(false);
  });
});
