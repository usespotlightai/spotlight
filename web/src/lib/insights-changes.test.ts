import { describe, expect, it } from 'vitest';
import {
  frontierOf,
  harnessGroupsOf,
  type InsightsChanges,
  markerOf,
  type SetupOutcome,
  setupPoints,
  setupShown,
  setupWithinShown,
  sizeRuleShown,
} from '@/lib/insights-changes';

const setup = (over: Partial<SetupOutcome>): SetupOutcome =>
  ({
    harness: 'claude-code',
    model: 'sonnet',
    effort: null,
    profileKey: null,
    tally: { runs: 5 },
    costPerRun: 1,
    currency: 'USD',
    outcomes: {
      accepted: 0.5,
      sent_back: 0.2,
      handed_on: null,
      checks_passed: null,
      merged: null,
      judge: null,
    },
    judge: { mean: null, judged: 0 },
    frontier: [],
    ...over,
  }) as SetupOutcome;

const HARNESSES = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    models: [],
    defaultModel: '',
    efforts: [],
  },
];

describe('setupShown', () => {
  it('names the harness, model, effort and profile it ran with', () => {
    expect(
      setupShown(
        setup({ model: null, effort: 'high', profileKey: 'careful' }),
        HARNESSES,
      ),
    ).toBe('Claude Code · Harness default · high effort · careful profile');
  });
});

describe('harnessGroupsOf and setupWithinShown', () => {
  it('groups setups by harness in the order they come, naming each within its harness', () => {
    const groups = harnessGroupsOf([
      setup({ model: 'sonnet' }),
      setup({ harness: 'cursor', model: null, profileKey: 'careful' }),
      setup({ model: 'opus', effort: 'high' }),
    ]);

    expect(
      groups.map((group) => [
        group.harness,
        group.setups.map(setupWithinShown),
      ]),
    ).toEqual([
      ['claude-code', ['sonnet', 'opus · high effort']],
      ['cursor', ['Harness default · careful profile']],
    ]);
  });
});

describe('setupPoints', () => {
  it('places each priced setup by cost and outcome, leaving out the rest', () => {
    const points = setupPoints(
      [
        setup({ frontier: ['accepted'] }),
        setup({ model: 'opus', costPerRun: null }),
        setup({ model: 'haiku', currency: 'EUR' }),
        setup({
          model: 'judged',
          outcomes: { ...setup({}).outcomes, accepted: null },
        }),
      ],
      'accepted',
      HARNESSES,
      'USD',
    );

    expect(points).toEqual([
      {
        key: JSON.stringify(['claude-code', 'sonnet', null, null]),
        label: 'Claude Code · sonnet',
        cost: 1,
        value: 0.5,
        runs: 5,
        frontier: true,
      },
    ]);
  });
});

describe('frontierOf', () => {
  it('runs along the frontier from the cheapest setup up', () => {
    const point = (key: string, cost: number, frontier: boolean) => ({
      key,
      label: key,
      cost,
      value: cost / 10,
      runs: 3,
      frontier,
    });

    expect(
      frontierOf([
        point('dear', 3, true),
        point('cheap', 1, true),
        point('off', 2, false),
      ]).map((each) => each.key),
    ).toEqual(['cheap', 'dear']);
  });
});

describe('sizeRuleShown', () => {
  it('says each size’s bound in lines and steps, and that the largest has none', () => {
    expect(sizeRuleShown({ size: 'small', mostLines: 50, mostSteps: 20 })).toBe(
      'Small: up to 50 changed lines, or 20 steps for a run that changed none',
    );
    expect(
      sizeRuleShown({ size: 'large', mostLines: null, mostSteps: null }),
    ).toBe('Large: anything bigger');
  });
});

describe('markerOf', () => {
  it('finds a change by the run it took effect in, though its config returns later', () => {
    const changes = {
      markers: [
        { stationId: 'station_1', fingerprint: 'b', runId: 'run_2' },
        { stationId: 'station_1', fingerprint: 'a', runId: 'run_3' },
        { stationId: 'station_1', fingerprint: 'b', runId: 'run_4' },
      ],
    } as unknown as InsightsChanges;

    expect(markerOf(changes, { stationId: 'station_1', runId: 'run_4' })).toBe(
      changes.markers[2],
    );
    expect(
      markerOf(changes, { stationId: 'station_1', runId: 'run_5' }),
    ).toBeNull();
  });
});
