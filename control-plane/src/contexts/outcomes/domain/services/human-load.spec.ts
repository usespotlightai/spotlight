import { day, historyOf, touchesOf } from '@outcomes/domain/insights.fake-spec';
import { endedRecord } from '@outcomes/domain/outcomes.fake-spec';
import {
  type HumanLoad,
  humanLoadChangesOf,
  humanLoadOf,
} from '@outcomes/domain/services/human-load';
import { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { describe, expect, it } from 'vitest';

const PERIOD = InsightsPeriod.of('7d', new Date('2026-10-01T15:00:00.000Z'));

describe('humanLoadOf', () => {
  it('counts what the work asked of people and how quickly they answered', () => {
    const load = humanLoadOf(
      historyOf({
        records: [
          endedRecord('run_1', {
            taskId: 'task_1',
            endedAt: day('2026-09-26'),
          }).actedOn(NextAct.of('sent-back', day('2026-09-26', 13))),
          endedRecord('run_2', {
            taskId: 'task_2',
            endedAt: day('2026-09-26'),
          }),
        ],
        touches: [
          touchesOf('task_1', {
            asks: [
              ['station_1', day('2026-09-26', 9)],
              ['station_1', day('2026-09-27', 9)],
            ],
            acts: [
              ['answered', 'user_bob', 'station_1', day('2026-09-26', 10)],
              ['refused', 'user_bob', 'station_1', day('2026-09-27', 11)],
            ],
          }),
        ],
      }),
      PERIOD.current,
    );

    expect(load).toEqual({
      asks: 2,
      tasks: 2,
      asksPerTask: 1,
      toAnswer: { p50: 5_400_000, p90: 7_200_000, count: 2 },
      unanswered: 0,
      sentBack: 1,
      sentBackRate: 0.5,
      refused: 1,
      askedTaskIds: ['task_1'],
      refusedTaskIds: ['task_1'],
    });
  });
});

const load = (over: Partial<HumanLoad> = {}): HumanLoad => ({
  asks: 4,
  tasks: 4,
  asksPerTask: 1,
  toAnswer: { p50: 600_000, p90: 900_000, count: 4 },
  unanswered: 0,
  sentBack: 2,
  sentBackRate: 0.25,
  refused: 0,
  askedTaskIds: [],
  refusedTaskIds: [],
  ...over,
});

describe('humanLoadChangesOf', () => {
  it('moves the sent-back rate by points and the rest by percent, fewer being better', () => {
    const changes = humanLoadChangesOf(
      load({
        asksPerTask: 0.5,
        toAnswer: { p50: 1_200_000, p90: null, count: 2 },
        sentBackRate: 0.1,
        refused: 2,
      }),
      load(),
    );

    expect(changes.asksPerTask).toMatchObject({ by: -0.5, tone: 'good' });
    expect(changes.toAnswer).toMatchObject({ by: 1, tone: 'bad' });
    expect(changes.sentBackRate).toMatchObject({
      unit: 'points',
      direction: 'down',
      tone: 'good',
    });
    expect(changes.sentBackRate?.by).toBeCloseTo(-0.15);
    expect(changes.refused).toMatchObject({ fromZero: true, tone: 'bad' });
  });
});
