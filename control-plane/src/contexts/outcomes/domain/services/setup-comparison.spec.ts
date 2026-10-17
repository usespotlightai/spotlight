import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import { day, deliveredOf } from '@outcomes/domain/insights.fake-spec';
import { costedRecord } from '@outcomes/domain/outcomes.fake-spec';
import {
  judgeWithheldFrom,
  setupCountsOf,
  setupsFrom,
} from '@outcomes/domain/services/setup-comparison';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { describe, expect, it } from 'vitest';

const RUBRIC = 'c'.repeat(64);

const comparedOf = (
  records: readonly RunRecord[],
  deliveries: readonly TaskDelivery[],
  shares: ReadonlyMap<string, number> | null,
) =>
  setupsFrom(
    setupCountsOf(
      records,
      deliveries,
      [...(shares ?? new Map()).entries()].map(([runId, share]) => ({
        runId,
        rubricVersion: RUBRIC,
        share,
      })),
    ).setups,
    shares === null ? { withheld: true } : { withheld: false, trusted: RUBRIC },
  );

const runs = (
  prefix: string,
  count: number,
  setup: {
    model: string;
    effort?: string | null;
    amount: number;
    accepted: number;
    unanswered?: number;
    currency?: string;
  },
) =>
  Array.from({ length: count }, (_, at) => {
    const record = costedRecord(`${prefix}_${at}`, {
      taskId: `${prefix}_task_${at}`,
      model: setup.model,
      effort: setup.effort ?? null,
      amount: setup.amount,
      currency: setup.currency ?? 'USD',
      endedAt: day('2026-09-30', at),
    });

    if (at < setup.accepted) {
      return record.recordAction(NextAct.of('closed', day('2026-09-30', at)));
    }

    return at < count - (setup.unanswered ?? 0)
      ? record.recordAction(NextAct.of('sent-back', day('2026-09-30', at)))
      : record;
  });

describe('setupsFrom', () => {
  it('compares runs by harness, model, effort and profile', () => {
    const compared = comparedOf(
      [
        ...runs('sonnet', 4, { model: 'sonnet', amount: 1, accepted: 2 }),
        ...runs('sonnet_high', 3, {
          model: 'sonnet',
          effort: 'high',
          amount: 2,
          accepted: 3,
        }),
      ],
      [],
      new Map(),
    );

    expect(
      compared.setups.map((each) => [
        each.model,
        each.effort,
        each.tally.runs,
        each.costPerRun,
        each.outcomes.accepted,
      ]),
    ).toEqual([
      ['sonnet', null, 4, 1, 0.5],
      ['sonnet', 'high', 3, 2, 1],
    ]);
  });

  it('reads accepted and sent-back shares only from runs a person answered', () => {
    const compared = comparedOf(
      runs('sonnet', 4, {
        model: 'sonnet',
        amount: 1,
        accepted: 1,
        unanswered: 2,
      }),
      [],
      new Map(),
    );

    expect(compared.setups[0]?.outcomes.accepted).toBe(0.5);
    expect(compared.setups[0]?.outcomes.sent_back).toBe(0.5);
    expect(compared.setups[0]?.outcomes.merged).toBeNull();
  });

  it('marks the setups no other beats on both cost and outcome', () => {
    const compared = comparedOf(
      [
        ...runs('cheap', 4, { model: 'haiku', amount: 0.5, accepted: 2 }),
        ...runs('good', 4, { model: 'sonnet', amount: 1, accepted: 4 }),
        ...runs('worse', 4, { model: 'opus', amount: 3, accepted: 3 }),
      ],
      [],
      new Map(),
    );
    const frontier = (model: string) =>
      compared.setups.find((each) => each.model === model)?.frontier ?? [];

    expect(frontier('haiku')).toContain('accepted');
    expect(frontier('sonnet')).toContain('accepted');
    expect(frontier('opus')).not.toContain('accepted');
    expect(frontier('haiku')).toContain('sent_back');
  });

  it('leaves a setup with too few runs, or priced in another currency, off the frontier', () => {
    const compared = comparedOf(
      [
        ...runs('main', 4, { model: 'sonnet', amount: 1, accepted: 2 }),
        ...runs('few', 2, { model: 'haiku', amount: 0.1, accepted: 2 }),
        ...runs('euro', 3, {
          model: 'opus',
          amount: 0.1,
          accepted: 3,
          currency: 'EUR',
        }),
      ],
      [],
      new Map(),
    );

    expect(compared.currency).toBe('USD');
    expect(
      compared.setups.find((each) => each.model === 'haiku')?.frontier,
    ).toEqual([]);
    expect(
      compared.setups.find((each) => each.model === 'opus')?.frontier,
    ).toEqual([]);
    expect(
      compared.setups.find((each) => each.model === 'sonnet')?.frontier,
    ).toContain('accepted');
  });

  it('prices for the chart only setups costed in the comparison’s currency', () => {
    const compared = comparedOf(
      [
        ...runs('main', 4, { model: 'sonnet', amount: 1, accepted: 2 }),
        ...runs('few', 2, { model: 'haiku', amount: 0.1, accepted: 2 }),
        ...runs('euro', 3, {
          model: 'opus',
          amount: 0.1,
          accepted: 3,
          currency: 'EUR',
        }),
      ],
      [],
      new Map(),
    );
    const pricedOf = (model: string) =>
      compared.setups.find((each) => each.model === model)?.priced;

    expect(pricedOf('sonnet')).toBe(true);
    expect(pricedOf('haiku')).toBe(true);
    expect(pricedOf('opus')).toBe(false);
  });

  it('averages only the judge scores it is given', () => {
    const compared = comparedOf(
      runs('judged', 3, { model: 'sonnet', amount: 1, accepted: 0 }),
      [],
      new Map([
        ['judged_0', 1],
        ['judged_1', 0.5],
      ]),
    );

    expect(compared.setups[0]?.judge).toEqual({ mean: 0.75, judged: 2 });
    expect(compared.setups[0]?.outcomes.judge).toBe(0.75);
  });

  it('withholds judge scores when given none, leaving the judge off every frontier', () => {
    const compared = comparedOf(
      runs('judged', 3, { model: 'sonnet', amount: 1, accepted: 0 }),
      [],
      null,
    );

    expect(compared.setups[0]?.judge).toBeNull();
    expect(compared.setups[0]?.outcomes.judge).toBeNull();
    expect(compared.setups[0]?.frontier).not.toContain('judge');
  });
});

describe('judgeWithheldFrom', () => {
  it('compares judge scores only within one station, since each station’s judge scores against its own rubric', () => {
    expect(judgeWithheldFrom(null)).toBe('no_station');
    expect(judgeWithheldFrom('station_1')).toBeNull();
  });
});

describe('setups from their counts', () => {
  const judged = runs('judged', 3, { model: 'sonnet', amount: 1, accepted: 0 });
  const counts = setupCountsOf(
    judged,
    [],
    [
      { runId: 'judged_0', rubricVersion: 'rubric_1', share: 0 },
      { runId: 'judged_1', rubricVersion: 'rubric_1', share: 0 },
      { runId: 'judged_0', rubricVersion: 'rubric_2', share: 1 },
      { runId: 'judged_2', rubricVersion: 'rubric_2', share: 0.5 },
    ],
  ).setups;

  it('takes the judge’s mean from the trusted rubric only', () => {
    const [setup] = setupsFrom(counts, {
      withheld: false,
      trusted: 'rubric_2',
    }).setups;

    expect(setup?.judge).toEqual({ mean: 0.75, judged: 2 });
  });

  it('shows no judge mean when no rubric at the station is trusted', () => {
    const [setup] = setupsFrom(counts, {
      withheld: false,
      trusted: null,
    }).setups;

    expect(setup?.judge).toEqual({ mean: null, judged: 0 });
  });

  it('counts merges over the tasks whose delivery finished', () => {
    const [setup] = comparedOf(
      [
        ...runs('merging', 3, { model: 'sonnet', amount: 1, accepted: 3 }),
        costedRecord('merging_again', {
          taskId: 'merging_task_0',
          model: 'sonnet',
          amount: 1,
          endedAt: day('2026-09-30', 5),
        }),
      ],
      [
        deliveredOf('merging_task_0', {
          openedAt: day('2026-09-29'),
          closedAt: day('2026-09-30'),
          merged: true,
        }),
        deliveredOf('merging_task_1', {
          openedAt: day('2026-09-29'),
          closedAt: day('2026-09-30'),
          merged: false,
        }),
        deliveredOf('merging_task_2', { openedAt: day('2026-09-29') }),
      ],
      null,
    ).setups;

    expect(setup?.outcomes.merged).toBe(0.5);
  });
});
