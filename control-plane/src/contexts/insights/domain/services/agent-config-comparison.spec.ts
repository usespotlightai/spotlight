import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { TaskPullRequest } from '@insights/domain/aggregates/task-pull-request.aggregate';
import { day, taskPullRequestOf } from '@insights/domain/insights.fake-spec';
import { costedRecord } from '@insights/domain/runs.fake-spec';
import {
  agentConfigCountsOf,
  agentConfigsFrom,
  judgeOmittedFor,
} from '@insights/domain/services/agent-config-comparison';
import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import { describe, expect, it } from 'vitest';

const RUBRIC = 'c'.repeat(64);

const comparedOf = (
  records: readonly RunRecord[],
  taskPullRequests: readonly TaskPullRequest[],
  rates: ReadonlyMap<string, number> | null,
) =>
  agentConfigsFrom(
    agentConfigCountsOf(
      records,
      taskPullRequests,
      [...(rates ?? new Map()).entries()].map(([runId, rate]) => ({
        runId,
        rubricVersion: RUBRIC,
        rate,
      })),
    ).agentConfigs,
    rates === null ? { omitted: true } : { omitted: false, qualified: RUBRIC },
  );

const runs = (
  prefix: string,
  count: number,
  agentConfig: {
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
      model: agentConfig.model,
      effort: agentConfig.effort ?? null,
      amount: agentConfig.amount,
      currency: agentConfig.currency ?? 'USD',
      endedAt: day('2026-09-30', at),
    });

    if (at < agentConfig.accepted) {
      return record.recordAction(
        HumanAction.of('accepted', day('2026-09-30', at)),
      );
    }

    return at < count - (agentConfig.unanswered ?? 0)
      ? record.recordAction(HumanAction.of('sent-back', day('2026-09-30', at)))
      : record;
  });

describe('agentConfigsFrom', () => {
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
      compared.agentConfigs.map((each) => [
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

    expect(compared.agentConfigs[0]?.outcomes.accepted).toBe(0.5);
    expect(compared.agentConfigs[0]?.outcomes.sent_back).toBe(0.5);
    expect(compared.agentConfigs[0]?.outcomes.merged).toBeNull();
  });

  it('marks the agent configs no other beats on both cost and outcome', () => {
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
      compared.agentConfigs.find((each) => each.model === model)?.frontier ??
      [];

    expect(frontier('haiku')).toContain('accepted');
    expect(frontier('sonnet')).toContain('accepted');
    expect(frontier('opus')).not.toContain('accepted');
    expect(frontier('haiku')).toContain('sent_back');
  });

  it('leaves an agent config with too few runs, or priced in another currency, off the frontier', () => {
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
      compared.agentConfigs.find((each) => each.model === 'haiku')?.frontier,
    ).toEqual([]);
    expect(
      compared.agentConfigs.find((each) => each.model === 'opus')?.frontier,
    ).toEqual([]);
    expect(
      compared.agentConfigs.find((each) => each.model === 'sonnet')?.frontier,
    ).toContain('accepted');
  });

  it('prices for the chart only agent configs costed in the comparison’s currency', () => {
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
      compared.agentConfigs.find((each) => each.model === model)?.priced;

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

    expect(compared.agentConfigs[0]?.judge).toEqual({ mean: 0.75, judged: 2 });
    expect(compared.agentConfigs[0]?.outcomes.judge).toBe(0.75);
  });

  it('omits judge scores when given none, leaving the judge off every frontier', () => {
    const compared = comparedOf(
      runs('judged', 3, { model: 'sonnet', amount: 1, accepted: 0 }),
      [],
      null,
    );

    expect(compared.agentConfigs[0]?.judge).toBeNull();
    expect(compared.agentConfigs[0]?.outcomes.judge).toBeNull();
    expect(compared.agentConfigs[0]?.frontier).not.toContain('judge');
  });
});

describe('judgeOmittedFor', () => {
  it('compares judge scores only within one station, since each station’s judge scores against its own rubric', () => {
    expect(judgeOmittedFor(null)).toBe('no_station');
    expect(judgeOmittedFor('station_1')).toBeNull();
  });
});

describe('agent configs from their counts', () => {
  const judged = runs('judged', 3, { model: 'sonnet', amount: 1, accepted: 0 });
  const counts = agentConfigCountsOf(
    judged,
    [],
    [
      { runId: 'judged_0', rubricVersion: 'rubric_1', rate: 0 },
      { runId: 'judged_1', rubricVersion: 'rubric_1', rate: 0 },
      { runId: 'judged_0', rubricVersion: 'rubric_2', rate: 1 },
      { runId: 'judged_2', rubricVersion: 'rubric_2', rate: 0.5 },
    ],
  ).agentConfigs;

  it('takes the judge’s mean from the qualified rubric only', () => {
    const [agentConfig] = agentConfigsFrom(counts, {
      omitted: false,
      qualified: 'rubric_2',
    }).agentConfigs;

    expect(agentConfig?.judge).toEqual({ mean: 0.75, judged: 2 });
  });

  it('shows no judge mean when no rubric at the station is qualified', () => {
    const [agentConfig] = agentConfigsFrom(counts, {
      omitted: false,
      qualified: null,
    }).agentConfigs;

    expect(agentConfig?.judge).toEqual({ mean: null, judged: 0 });
  });

  it('counts merges over the tasks whose pull request finished', () => {
    const [agentConfig] = comparedOf(
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
        taskPullRequestOf('merging_task_0', {
          openedAt: day('2026-09-29'),
          closedAt: day('2026-09-30'),
          merged: true,
        }),
        taskPullRequestOf('merging_task_1', {
          openedAt: day('2026-09-29'),
          closedAt: day('2026-09-30'),
          merged: false,
        }),
        taskPullRequestOf('merging_task_2', { openedAt: day('2026-09-29') }),
      ],
      null,
    ).agentConfigs;

    expect(agentConfig?.outcomes.merged).toBe(0.5);
  });
});
