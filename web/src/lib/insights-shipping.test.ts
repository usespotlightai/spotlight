import { describe, expect, it } from 'vitest';
import type {
  ByTypeResponseDto,
  InsightsShippingResponseDto,
  PercentilesResponseDto,
} from '@/lib/api';
import { stationNamesOf } from '@/lib/insights';
import { shippedNothing, shippingOf } from '@/lib/insights-shipping';

const HOUR = 3_600_000;

const spread = (hours: number | null): PercentilesResponseDto => ({
  p50Ms: hours === null ? null : hours * HOUR,
  p75Ms: hours === null ? null : 2 * hours * HOUR,
  p90Ms: hours === null ? null : 3 * hours * HOUR,
  p95Ms: hours === null ? null : 4 * hours * HOUR,
  count: hours === null ? 0 : 1,
});

const byType = (hours: number | null): ByTypeResponseDto => ({
  all: { total: spread(hours), parts: null },
  types:
    hours === null
      ? []
      : [{ type: 'fix', times: { total: spread(hours), parts: null } }],
});

const NOTHING: InsightsShippingResponseDto = {
  period: {
    name: '7d',
    from: '2026-09-24T00:00:00.000Z',
    to: '2026-10-01T00:00:00.000Z',
    previousFrom: '2026-09-17T00:00:00.000Z',
    previousTo: '2026-09-24T00:00:00.000Z',
    days: [],
  },
  truncated: false,
  toMerge: { spotlight: spread(null), people: spread(null) },
  toMergeBefore: { spotlight: spread(null), people: spread(null) },
  mergeDays: [],
  types: [],
  depth: [],
  reviewDays: [],
  bots: [],
  pipeline: {
    merged: 0,
    types: [],
    coding: byType(null),
    stations: [],
    awaitingReview: byType(null),
    inReview: byType(null),
    awaitingMerge: byType(null),
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
            { rounds: '1', merged: 2 },
            { rounds: '3+', merged: 1 },
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
        stations: [
          {
            lineId: 'line_1',
            stationId: 'station_build',
            times: {
              all: {
                total: spread(1),
                parts: {
                  queued: spread(0.25),
                  running: spread(0.5),
                  inbox: spread(0.25),
                },
              },
              types: [],
            },
          },
          { lineId: 'line_1', stationId: 'station_gone', times: byType(2) },
        ],
        inReview: byType(6),
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

  it('counts every round bucket, naming the missing ones none', () => {
    expect(shipping.depth[0]?.rounds).toEqual({
      '0': 0,
      '1': 2,
      '2': 0,
      '3+': 1,
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

  it('names stations from the lines and keeps their parts', () => {
    expect(shipping.pipeline.stations.map((each) => each.name)).toEqual([
      'Implementation',
      'A removed station',
    ]);
    expect(shipping.pipeline.stations[0]?.times.all.parts?.queued.p50).toBe(
      0.25 * HOUR,
    );
    expect(shipping.pipeline.stations[1]?.times.all.parts).toBeUndefined();
  });

  it('keys stage times by type and gathers the review stages', () => {
    expect(shipping.pipeline.review.inReview.types.fix?.total.p50).toBe(
      6 * HOUR,
    );
    expect(shipping.pipeline.review.awaitingMerge.types).toEqual({});
  });
});

describe('shippedNothing', () => {
  it('tells a period with nothing merged or reviewed apart', () => {
    expect(shippedNothing(shippingOf(NOTHING, NAMES))).toBe(true);
    expect(
      shippedNothing(
        shippingOf(
          {
            ...NOTHING,
            reviewDays: [
              {
                day: '2026-09-30',
                toFirstReviewDaily: spread(null),
                toFirstReviewRolling: spread(null),
                awaiting: 1,
                humanReviews: 0,
              },
            ],
          },
          NAMES,
        ),
      ),
    ).toBe(false);
  });
});
