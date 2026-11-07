import { createHash } from 'node:crypto';
import type {
  LineView,
  SearchPolicyView,
  StationView,
} from '@lines/application/contracts/line-view.contract';
import type { LineResourcesPort } from '@lines/application/ports/line-resources.port';
import type { LinesPort } from '@lines/application/ports/lines.port';
import { Work } from '@replays/infrastructure/acl/work.adapter';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { StartingPointHoldsPort } from '@work/application/ports/starting-point-holds.port';
import type {
  LiveStationConfig,
  StationConfigCandidatesPort,
} from '@work/application/ports/station-config-candidates.port';
import type { TrialableRunsPort } from '@work/application/ports/trialable-runs.port';
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

const LIVE: LiveStationConfig = {
  lineKey: 'delivery',
  config: {
    fingerprint: 'a'.repeat(64),
    handoverWords: ['ship'],
    ends: false,
    check: 'npm test',
    diffs: true,
    judge: null,
    rubricHash: null,
  },
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

const sha256 = (text: string): string =>
  createHash('sha256').update(text).digest('hex');

const workWith = (search: SearchPolicyView | null) =>
  new Work(
    {} as TrialableRunsPort,
    { live: async () => LIVE } as unknown as StationConfigCandidatesPort,
    { find: async () => lineWith(search) } as unknown as LinesPort,
    {
      withId: async () => ({
        definition: {
          stations: [{ key: 'build', name: 'Build', kind: 'work' }],
        },
      }),
    } as unknown as LineResourcesPort,
    {} as StartingPointHoldsPort,
    { sha256 },
  );

const live = (search: SearchPolicyView | null) =>
  workWith(search).live(LineId.of('line_1'), StationId.of('station_1'));

describe('Work.live', () => {
  it('reads the station’s search policy from its line', async () => {
    const read = await live(SEARCH);

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
    expect((await live(null))?.search).toBeNull();
  });

  it('names the config by the hashes of how it behaves and how it is scored', async () => {
    const behaviour = sha256(
      JSON.stringify({
        fingerprint: 'a'.repeat(64),
        options: ['ship'],
        ends: false,
      }),
    );
    const read = await live(null);

    expect(read?.hashes.behaviour).toBe(behaviour);
    expect(read?.hashes.scoring).toBe(
      sha256(
        JSON.stringify({
          behaviour,
          check: 'npm test',
          diffs: true,
          judge: null,
        }),
      ),
    );
    expect(read?.scoring.checksChanges).toBe(true);
  });
});
