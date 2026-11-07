import {
  type HumanLoad,
  humanLoadDeltasOf,
} from '@insights/domain/services/human-load';
import { describe, expect, it } from 'vitest';

const load = (over: Partial<HumanLoad> = {}): HumanLoad => ({
  asks: 4,
  tasks: 4,
  asksPerTask: 1,
  toAnswer: { p50: 600_000, p90: 900_000, count: 4 },
  unanswered: 0,
  sentBack: 2,
  sentBackRate: 0.25,
  dismissed: 0,
  askedTaskIds: [],
  dismissedTaskIds: [],
  ...over,
});

describe('humanLoadDeltasOf', () => {
  it('moves the sent-back rate by points and the rest by percent, fewer being better', () => {
    const changes = humanLoadDeltasOf(
      load({
        asksPerTask: 0.5,
        toAnswer: { p50: 1_200_000, p90: null, count: 2 },
        sentBackRate: 0.1,
        dismissed: 2,
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
    expect(changes.dismissed).toMatchObject({ fromZero: true, tone: 'bad' });
  });
});
