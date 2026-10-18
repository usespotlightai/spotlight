import { Work } from '@insights/infrastructure/acl/work.adapter';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { LineResourcesPort } from '@work/application/ports/line-resources.port';
import type {
  StationAlertShape,
  StationRunsPort,
} from '@work/application/ports/station-runs.port';
import { describe, expect, it } from 'vitest';

const alert = (shape: Partial<StationAlertShape>): StationAlertShape => ({
  measure: 'failed_rate',
  risesBy: null,
  above: null,
  fallsBy: null,
  below: null,
  over: 3,
  ...shape,
});

const workWith = (alerts: readonly StationAlertShape[] | null) => {
  const warned: string[] = [];
  const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: (fields) => {
      warned.push(String(fields.measure));
    },
    error: () => undefined,
  };
  const work = new Work(
    { alertsAt: async () => alerts } as unknown as StationRunsPort,
    {} as LineResourcesPort,
    logger,
  );

  return { work, warned };
};

describe('Work', () => {
  it('reads a station’s alerts as rules, skipping and logging any that Insights cannot watch', async () => {
    const { work, warned } = workWith([
      alert({ above: 0.5 }),
      alert({ measure: 'happiness', below: 0.2 }),
      alert({ above: 0.5, below: 0.1 }),
    ]);

    const rules = await work.alertsAt('station_1');

    expect(rules?.map((each) => each.key)).toEqual(['failed_rate:above']);
    expect(warned).toEqual(['happiness', 'failed_rate']);
  });

  it('says a station is gone when work no longer has it', async () => {
    const { work } = workWith(null);

    expect(await work.alertsAt('station_1')).toBeNull();
  });
});
