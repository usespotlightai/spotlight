import {
  type DueInput,
  dueVerdict,
  monthSpentOf,
  monthStartOf,
  nextMonthStartOf,
  type SetInput,
  setVerdict,
} from '@replays/domain/services/search-schedule';
import { Money } from '@replays/domain/value-objects/money.vo';
import { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import { describe, expect, it } from 'vitest';

const HOUR = 60 * 60 * 1000;

const AGENT = SearchAgent.of({
  harness: 'claude-code',
  model: null,
  effort: null,
});

const DAY = 24 * HOUR;

const NOW = new Date('2026-10-28T12:00:00.000Z');

const ago = (ms: number) => new Date(NOW.getTime() - ms);

const ahead = (ms: number) => new Date(NOW.getTime() + ms);

const policyOf = (over: Partial<Parameters<typeof SearchPolicy.of>[0]> = {}) =>
  SearchPolicy.of({
    enabled: true,
    monthlyCeiling: 50,
    currency: 'USD',
    ceiling: 10,
    periodMilliseconds: 7 * DAY,
    onAlert: true,
    cooldownMilliseconds: 3 * DAY,
    agent: null,
    iterations: null,
    repeats: null,
    objective: null,
    ...over,
  });

const due = (over: Partial<DueInput> = {}): DueInput => ({
  policy: policyOf(),
  scores: true,
  lastStartedAt: null,
  alertPendingSince: null,
  now: NOW,
  busy: false,
  pullRequestOpen: false,
  monthSpent: Money.none('USD'),
  ...over,
  cooldownFrom: over.cooldownFrom ?? over.lastStartedAt ?? null,
});

const set = (over: Partial<SetInput> = {}): SetInput => ({
  now: NOW,
  tooSmall: false,
  warnings: [],
  freshHeldOut: true,
  affordable: true,
  agent: AGENT,
  ...over,
});

describe('dueVerdict', () => {
  it('starts a station never searched, on schedule, with its policy', () => {
    expect(dueVerdict(due())).toEqual({
      kind: 'start',
      trigger: 'schedule',
      policy: policyOf(),
    });
  });

  it('skips a station whose policy is off or missing, and looks again a day later', () => {
    const skipped = {
      kind: 'skip',
      reason: 'disabled',
      checkAfter: ahead(DAY),
    };

    expect(dueVerdict(due({ policy: policyOf({ enabled: false }) }))).toEqual(
      skipped,
    );
    expect(dueVerdict(due({ policy: null }))).toEqual(skipped);
  });

  it('skips a station with no judge and no check before anything else but the policy, and looks again a day later', () => {
    expect(dueVerdict(due({ scores: false, busy: true }))).toEqual({
      kind: 'skip',
      reason: 'no-scoring',
      checkAfter: ahead(DAY),
    });
    expect(
      dueVerdict(due({ scores: false, policy: policyOf({ enabled: false }) })),
    ).toMatchObject({ reason: 'disabled' });
  });

  it('waits an hour while a search of the station runs', () => {
    expect(dueVerdict(due({ busy: true }))).toEqual({
      kind: 'wait',
      checkAfter: ahead(HOUR),
    });
  });

  it('waits until the period ends after the last start', () => {
    expect(dueVerdict(due({ lastStartedAt: ago(2 * DAY) }))).toEqual({
      kind: 'wait',
      checkAfter: ahead(5 * DAY),
    });
    expect(dueVerdict(due({ lastStartedAt: ago(7 * DAY) }))).toMatchObject({
      kind: 'start',
      trigger: 'schedule',
    });
  });

  it('starts on a pending alert once the cooldown ends, and skips for the cooldown before', () => {
    expect(
      dueVerdict(
        due({ lastStartedAt: ago(4 * DAY), alertPendingSince: ago(HOUR) }),
      ),
    ).toMatchObject({ kind: 'start', trigger: 'alert' });
    expect(
      dueVerdict(
        due({ lastStartedAt: ago(DAY), alertPendingSince: ago(HOUR) }),
      ),
    ).toEqual({ kind: 'skip', reason: 'cooldown', checkAfter: ahead(2 * DAY) });
  });

  it('skips for the cooldown after a person rejects a config pull request, even when the period has ended', () => {
    expect(
      dueVerdict(due({ lastStartedAt: ago(8 * DAY), cooldownFrom: ago(DAY) })),
    ).toEqual({ kind: 'skip', reason: 'cooldown', checkAfter: ahead(2 * DAY) });
  });

  it('ignores an alert when the policy does not search on alerts', () => {
    expect(
      dueVerdict(
        due({
          policy: policyOf({ onAlert: false }),
          lastStartedAt: ago(4 * DAY),
          alertPendingSince: ago(HOUR),
        }),
      ),
    ).toEqual({ kind: 'wait', checkAfter: ahead(3 * DAY) });
  });

  it('skips while a config pull request of the station is open', () => {
    expect(dueVerdict(due({ pullRequestOpen: true }))).toEqual({
      kind: 'skip',
      reason: 'pull-request-open',
      checkAfter: ahead(HOUR),
    });
  });

  it('skips until next month when one more search could pass the monthly ceiling', () => {
    expect(dueVerdict(due({ monthSpent: Money.of(40, 'USD') }))).toMatchObject({
      kind: 'start',
      trigger: 'schedule',
    });
    expect(dueVerdict(due({ monthSpent: Money.of(40.01, 'USD') }))).toEqual({
      kind: 'skip',
      reason: 'monthly-ceiling',
      checkAfter: new Date('2026-11-01T00:00:00.000Z'),
    });
  });
});

describe('setVerdict', () => {
  it('goes with the agent when the set is big enough, healthy, fresh and affordable', () => {
    expect(setVerdict(set())).toEqual({ kind: 'go', agent: AGENT });
  });

  it('skips for the first failing gate, and looks again a day later', () => {
    const cases: [Partial<SetInput>, string][] = [
      [{ tooSmall: true }, 'set-too-small'],
      [
        {
          warnings: [
            { kind: 'noise-unmeasured' },
            { kind: 'saturated', rate: 1 },
            { kind: 'flaky-checks', flaky: 1, rechecked: 5 },
          ],
        },
        'flaky-checks',
      ],
      [
        {
          warnings: [
            {
              kind: 'noisy',
              spread: 0.2,
              minGain: 0.05,
              neededRepeats: 4,
              suggestedRepeats: 4,
            },
          ],
        },
        'noisy',
      ],
      [
        { warnings: [{ kind: 'judge-unstable', agreement: 0.5, compared: 5 }] },
        'judge-unstable',
      ],
      [
        {
          warnings: [
            { kind: 'no-headroom', gain: 0, low: -0.1, high: 0.1, answered: 5 },
          ],
        },
        'no-headroom',
      ],
      [{ freshHeldOut: false }, 'no-fresh-held-out'],
      [{ affordable: false }, 'ceiling-too-low'],
      [{ agent: null }, 'no-agent'],
    ];

    for (const [over, reason] of cases) {
      expect(setVerdict(set(over))).toEqual({
        kind: 'skip',
        reason,
        checkAfter: ahead(DAY),
      });
    }
  });

  it('starts despite warnings that do not skip: unmeasured noise and saturation', () => {
    expect(
      setVerdict(
        set({
          warnings: [
            { kind: 'noise-unmeasured' },
            { kind: 'saturated', rate: 1 },
          ],
        }),
      ),
    ).toEqual({ kind: 'go', agent: AGENT });
  });
});

describe('month spend', () => {
  it('sums spends in the policy currency from the start of the UTC month', () => {
    expect(monthStartOf(NOW)).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    expect(nextMonthStartOf(new Date('2026-12-31T23:59:59.000Z'))).toEqual(
      new Date('2027-01-01T00:00:00.000Z'),
    );
    const spent = (amount: number, currency = 'USD', isActive = false) => ({
      isActive,
      spent: Money.of(amount, currency),
      budget: { ceiling: Money.of(10, currency) },
    });

    expect(
      monthSpentOf([spent(2), spent(5, 'EUR'), spent(1.5)], 'USD'),
    ).toEqual(Money.of(3.5, 'USD'));
  });

  it('counts an active search at its ceiling until it spends past it', () => {
    expect(
      monthSpentOf(
        [
          {
            isActive: true,
            spent: Money.of(1, 'USD'),
            budget: { ceiling: Money.of(10, 'USD') },
          },
          {
            isActive: true,
            spent: Money.of(12, 'USD'),
            budget: { ceiling: Money.of(10, 'USD') },
          },
        ],
        'USD',
      ),
    ).toEqual(Money.of(22, 'USD'));
  });
});
