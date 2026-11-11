import { createHash } from 'node:crypto';

import { StationConfigCandidates } from '@replays/infrastructure/acl/station-config-candidates.adapter';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type {
  LiveStationConfig,
  StationConfigCandidatesPort,
} from '@work/application/ports/station-config-candidates.port';
import { describe, expect, it } from 'vitest';

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

const sha256 = (text: string): string =>
  createHash('sha256').update(text).digest('hex');

const live = () =>
  new StationConfigCandidates(
    { live: async () => LIVE } as unknown as StationConfigCandidatesPort,
    { sha256 },
  ).live(LineId.of('line_1'), StationId.of('station_1'));

describe('StationConfigCandidates.live', () => {
  it('names the config by the hashes of how it behaves and how it is scored', async () => {
    const behaviour = sha256(
      JSON.stringify({
        fingerprint: 'a'.repeat(64),
        options: ['ship'],
        ends: false,
      }),
    );
    const read = await live();

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
