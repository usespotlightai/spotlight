import { ForgetGoneStationOrigins } from '@replays/application/services/forget-gone-station-origins.service';
import {
  FakeWork,
  InMemoryReplays,
} from '@replays/application/services/replays.fake-spec';
import {
  BY,
  candidateKindOf,
  STATION,
} from '@replays/domain/replays.fake-spec';
import { describe, expect, it } from 'vitest';

const withdrawnAt = async (memory: InMemoryReplays, stationId: string) => {
  const proposed = candidateKindOf({
    kind: 'proposed',
    id: `candidate_${stationId}`,
    stationId,
  });

  await memory.candidateRepository.add(proposed);
  await memory.candidateRepository.save(proposed.withdrawn(false, BY));
};

describe('ForgetGoneStationOrigins', () => {
  it('forgets the withdrawn origins of stations a line no longer has, keeping those of stations it still has', async () => {
    const memory = new InMemoryReplays();
    await withdrawnAt(memory, STATION.stationId);
    await withdrawnAt(memory, 'station_gone');
    await withdrawnAt(memory, 'station_untouched');

    const work = new FakeWork();
    work.gone.add('station_gone');

    await new ForgetGoneStationOrigins(
      memory.candidateRepository,
      work,
    ).lineRedefined({
      lineId: STATION.lineId,
      stationIds: [STATION.stationId, 'station_gone', 'station_gone'],
    });

    expect([...memory.withdrawnOrigins.keys()].sort()).toEqual([
      `candidate_${STATION.stationId}`,
      'candidate_station_untouched',
    ]);
  });
});
