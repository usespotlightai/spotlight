import { describe, expect, it } from 'vitest';
import type {
  ByTypeResponseDto,
  FlowStageResponseDto,
  InsightsShippingResponseDto,
  PercentilesResponseDto,
  StageTimesResponseDto,
} from '@/lib/api';
import { stationNamesOf } from '@/lib/insights';
import { flowStages, shippingOf, slowestFirst } from '@/lib/insights-shipping';

const HOUR = 3_600_000;

const spread = (hours: number | null): PercentilesResponseDto => ({
  p50Ms: hours === null ? null : hours * HOUR,
  p75Ms: hours === null ? null : 2 * hours * HOUR,
  p90Ms: hours === null ? null : 3 * hours * HOUR,
  p95Ms: hours === null ? null : 4 * hours * HOUR,
  count: hours === null ? 0 : 1,
});

const UNJUDGED = { p50: 0, p75: 0, p90: 0, p95: 0 };
const NOT_WORST = { p50: false, p75: false, p90: false, p95: false };

const times = (
  hours: number | null,
  over: Partial<StageTimesResponseDto> = {},
): StageTimesResponseDto => ({
  total: spread(hours),
  parts: null,
  jam: UNJUDGED,
  worst: NOT_WORST,
  longestPart: null,
  ...over,
});

const byType = (hours: number | null): ByTypeResponseDto => ({
  all: times(hours),
  types: hours === null ? [] : [{ type: 'fix', times: times(hours) }],
});

const stage = (
  kind: FlowStageResponseDto['kind'],
  byTyped: ByTypeResponseDto,
  stationId: string | null = null,
): FlowStageResponseDto => ({
  kind,
  lineId: stationId ? 'line_1' : null,
  stationId,
  times: byTyped,
});

const NOTHING: InsightsShippingResponseDto = {
  shippedAny: false,
  period: {
    name: '7d',
    from: '2026-09-24T00:00:00.000Z',
    to: '2026-10-01T00:00:00.000Z',
    previousFrom: '2026-09-17T00:00:00.000Z',
    previousTo: '2026-09-24T00:00:00.000Z',
    days: [],
  },
  toMerge: { spotlight: spread(null), people: spread(null) },
  toMergeChanges: {
    spotlight: { p50: null, p75: null, p90: null, p95: null },
    people: { p50: null, p75: null, p90: null, p95: null },
  },
  mergeDays: [],
  types: [],
  slowestFirst: { p50: [], p75: [], p90: [], p95: [] },
  depth: [],
  depthTotals: [],
  reviewDays: [],
  bots: [],
  pipeline: {
    merged: 0,
    types: [],
    layouts: { stations: [], stages: [] },
  },
};

const NAMES = stationNamesOf([
  {
    id: 'line_1',
    key: 'delivery',
    name: 'Delivery',
    reactions: [],
    repositories: [],
    source: null,
    replayCheck: null,
    stations: [
      {
        id: 'station_build',
        key: 'build',
        name: 'Implementation',
        position: 1,
        color: '#5c66d9',
        kind: 'work',
        description: null,
        harness: 'claude-code',
        model: null,
        effort: null,
        agentPrompt: null,
        judge: null,
        alerts: [],
        skills: [],
      },
    ],
  },
] as never);

describe('shippingOf', () => {
  const shipping = shippingOf(
    {
      ...NOTHING,
      toMerge: { spotlight: spread(4), people: spread(null) },
      depth: [
        {
          week: '2026-09-28',
          merged: 3,
          rounds: [
            { rounds: '1', merged: 2, share: 2 / 3 },
            { rounds: '3+', merged: 1, share: 1 / 3 },
          ],
        },
      ],
      reviewDays: [
        {
          day: '2026-09-30',
          toFirstReviewDaily: spread(2),
          toFirstReviewRolling: spread(3),
          awaiting: 4,
          humanReviews: 5,
        },
      ],
      pipeline: {
        ...NOTHING.pipeline,
        merged: 1,
        layouts: {
          stations: [
            stage(
              'station',
              {
                all: times(1, {
                  parts: {
                    queued: spread(0.25),
                    running: spread(0.5),
                    inbox: spread(0.25),
                  },
                  jam: { p50: 1 / 6, p75: 1 / 6, p90: 1 / 6, p95: 1 / 6 },
                  longestPart: {
                    p50: 'running',
                    p75: 'running',
                    p90: 'queued',
                    p95: 'inbox',
                  },
                }),
                types: [],
              },
              'station_build',
            ),
            stage('station', byType(2), 'station_gone'),
            stage('inReview', {
              all: times(6, {
                jam: { p50: 1, p75: 1, p90: 1, p95: 1 },
                worst: { p50: true, p75: true, p90: false, p95: true },
              }),
              types: [{ type: 'fix', times: times(6) }],
            }),
          ],
          stages: [stage('coding', byType(3)), stage('inReview', byType(6))],
        },
      },
    },
    NAMES,
  );

  it('reads percentiles in milliseconds', () => {
    expect(shipping.toMerge).toEqual({
      spotlight: {
        p50: 4 * HOUR,
        p75: 8 * HOUR,
        p90: 12 * HOUR,
        p95: 16 * HOUR,
      },
      people: { p50: null, p75: null, p90: null, p95: null },
    });
  });

  it('takes each round bucket’s share, naming the missing ones none', () => {
    expect(shipping.depth[0]).toEqual({
      week: '2026-09-28',
      merged: 3,
      '0': null,
      '1': 2 / 3,
      '2': null,
      '3+': 1 / 3,
    });
  });

  it('pairs each day’s first review times', () => {
    expect(shipping.reviewDays[0]).toMatchObject({
      toFirstReview: {
        daily: { p50: 2 * HOUR },
        rolling: { p50: 3 * HOUR },
      },
      awaiting: 4,
      humanReviews: 5,
    });
  });

  it('names stations from the lines and the other stages in words', () => {
    expect(
      flowStages(shipping.pipeline, 'stations', 'p50', null).map((each) => [
        each.id,
        each.label,
        each.station,
      ]),
    ).toEqual([
      ['station_build', 'Implementation', true],
      ['station_gone', 'A removed station', true],
      ['inReview', 'In review', false],
    ]);
    expect(
      flowStages(shipping.pipeline, 'stages', 'p50', null).map(
        (each) => each.label,
      ),
    ).toEqual(['Coding', 'In review']);
  });

  it('picks the times, jam, worst stage and longest part at the percentile', () => {
    const [build, gone, inReview] = flowStages(
      shipping.pipeline,
      'stations',
      'p90',
      null,
    );

    expect(build).toMatchObject({
      ms: 3 * HOUR,
      parts: { queued: 0.75 * HOUR, running: 1.5 * HOUR, inbox: 0.75 * HOUR },
      jam: 1 / 6,
      worst: false,
      longestPart: 'queued',
    });
    expect(gone?.parts).toBeNull();
    expect(inReview).toMatchObject({ ms: 18 * HOUR, jam: 1, worst: false });
    expect(
      flowStages(shipping.pipeline, 'stations', 'p50', null)[2]?.worst,
    ).toBe(true);
  });

  it('reads a type’s own times, and none where the type never passed', () => {
    const [build, , inReview] = flowStages(
      shipping.pipeline,
      'stations',
      'p50',
      'fix',
    );

    expect(build).toMatchObject({
      ms: null,
      parts: null,
      jam: 0,
      worst: false,
      longestPart: null,
    });
    expect(inReview?.ms).toBe(6 * HOUR);
  });
});

describe('slowestFirst', () => {
  it('orders the types as the server ranked them at the percentile', () => {
    const merges = {
      types: [
        { type: 'feature', merged: 3 },
        { type: 'fix', merged: 1 },
      ],
      slowestFirst: {
        p50: ['fix', 'feature'],
        p75: ['feature', 'fix'],
        p90: [],
        p95: [],
      },
    } as never;

    expect(slowestFirst(merges, 'p50').map((each) => each.type)).toEqual([
      'fix',
      'feature',
    ]);
    expect(slowestFirst(merges, 'p75').map((each) => each.type)).toEqual([
      'feature',
      'fix',
    ]);
  });
});
