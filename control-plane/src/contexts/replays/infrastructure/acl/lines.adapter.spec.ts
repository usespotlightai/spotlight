import type {
  LineView,
  SearchPolicyView,
  StationView,
} from '@lines/application/contracts/line-view.contract';
import type { LineResourcesPort } from '@lines/application/ports/line-resources.port';
import type { LinesPort } from '@lines/application/ports/lines.port';
import { Lines } from '@replays/infrastructure/acl/lines.adapter';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { describe, expect, it } from 'vitest';

const DAY = 24 * 60 * 60 * 1_000;

const SEARCH: SearchPolicyView = {
  enabled: true,
  monthlyCeiling: 50,
  currency: 'USD',
  ceiling: 10,
  period: '7d',
  periodMilliseconds: 7 * DAY,
  onAlert: true,
  cooldown: '3d',
  cooldownMilliseconds: 3 * DAY,
  agent: { harness: 'claude-code', model: null, effort: 'high' },
  iterations: 3,
  repeats: null,
  objective: 'cost',
};

const lineWith = (search: SearchPolicyView | null): LineView =>
  ({
    id: 'line_1',
    workspaceId: 'ws_1',
    teamId: 'team_1',
    key: 'delivery',
    name: 'Delivery',
    replayCheck: null,
    source: null,
    stations: [
      {
        id: 'station_1',
        key: 'build',
        name: 'Build',
        kind: 'work',
        harness: 'claude-code',
        model: null,
        effort: null,
        search,
      } as unknown as StationView,
    ],
  }) as unknown as LineView;

const settings = (search: SearchPolicyView | null) =>
  new Lines(
    { find: async () => lineWith(search) } as unknown as LinesPort,
    {
      withId: async () => ({
        definition: {
          stations: [{ key: 'build', name: 'Build', kind: 'work' }],
        },
      }),
    } as unknown as LineResourcesPort,
  ).stationSettings(LineId.of('line_1'), StationId.of('station_1'));

describe('Lines.stationSettings', () => {
  it('reads the station’s search policy from its line', async () => {
    const read = await settings(SEARCH);

    expect(read?.search).toMatchObject({
      enabled: true,
      periodMilliseconds: 7 * DAY,
      onAlert: true,
      cooldownMilliseconds: 3 * DAY,
      agent: { harness: 'claude-code', model: null, effort: 'high' },
      iterations: 3,
      repeats: null,
      objective: 'cost',
    });
    expect(read?.search?.ceiling.amount).toBe(10);
    expect(read?.search?.monthlyCeiling.amount).toBe(50);
    expect(read?.search?.ceiling.currency).toBe('USD');
    expect(read?.agent?.harness).toBe('claude-code');
  });

  it('has no search policy when the line sets none', async () => {
    expect((await settings(null))?.search).toBeNull();
  });
});
