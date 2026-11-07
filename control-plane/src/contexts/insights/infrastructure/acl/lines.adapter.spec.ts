import { Lines } from '@insights/infrastructure/acl/lines.adapter';
import type {
  LineView,
  StationAlertView,
  StationView,
} from '@lines/application/contracts/line-view.contract';
import type { LinesPort } from '@lines/application/ports/lines.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { describe, expect, it } from 'vitest';

const alert = (shape: Partial<StationAlertView>): StationAlertView => ({
  measure: 'failed_rate',
  risesBy: null,
  above: null,
  fallsBy: null,
  below: null,
  over: 3,
  ...shape,
});

const lineWith = (
  alerts: readonly StationAlertView[],
  repositories: readonly string[] = [],
): LineView =>
  ({
    id: 'line_1',
    repositories: repositories.map((repository) => ({
      repository,
      setup: null,
    })),
    stations: [{ id: 'station_1', alerts } as unknown as StationView],
  }) as unknown as LineView;

const linesWith = (lines: readonly LineView[]) => {
  const warned: string[] = [];
  const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: (fields) => {
      warned.push(String(fields.measure));
    },
    error: () => undefined,
  };
  const port = {
    findByStation: async (stationId: string) =>
      lines.find((line) =>
        line.stations.some((each) => each.id === stationId),
      ) ?? null,
    ofTeam: async () => lines,
  } as unknown as LinesPort;

  return { adapter: new Lines(port, logger), warned };
};

describe('Lines', () => {
  it('reads a station’s alerts as rules, skipping and logging any that Insights cannot watch', async () => {
    const { adapter, warned } = linesWith([
      lineWith([alert({ above: 0.5 }), alert({ above: 0.5, below: 0.1 })]),
    ]);

    const rules = await adapter.alertsAt('station_1');

    expect(rules?.map((each) => each.key)).toEqual(['failed_rate:above']);
    expect(warned).toEqual(['failed_rate']);
  });

  it('says a station is gone when no line has it', async () => {
    const { adapter } = linesWith([]);

    expect(await adapter.alertsAt('station_1')).toBeNull();
  });

  it('names each repository of the team’s lines once', async () => {
    const { adapter } = linesWith([
      lineWith([], ['acme/api', 'acme/web']),
      lineWith([], ['acme/api']),
    ]);

    expect(await adapter.teamRepositories('team_1')).toEqual([
      'acme/api',
      'acme/web',
    ]);
  });
});
