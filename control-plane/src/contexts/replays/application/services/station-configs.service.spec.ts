import {
  FakeLines,
  FakeStationConfigCandidates,
} from '@replays/application/services/replays.fake-spec';
import { StationConfigs } from '@replays/application/services/station-configs.service';
import { STATION } from '@replays/domain/replays.fake-spec';
import { describe, expect, it } from 'vitest';

const BLOCK = { key: 'build', name: 'Build', kind: 'work', prompt: 'ship' };

const configsWith = (
  change: (lines: FakeLines, candidates: FakeStationConfigCandidates) => void,
) => {
  const lines = new FakeLines();
  const candidates = new FakeStationConfigCandidates();

  change(lines, candidates);

  return new StationConfigs(candidates, lines);
};

describe('StationConfigs', () => {
  it('reads the live config from Work and its settings from the line', async () => {
    const live = await configsWith(() => {}).live(
      STATION.lineId,
      STATION.stationId,
    );

    expect(live?.lineKey).toBe('delivery');
    expect(live?.block.value).toMatchObject({ key: 'build' });
    expect(live?.search).toBeNull();
  });

  it('has no live config when the line no longer has the station', async () => {
    const configs = configsWith((lines) => {
      lines.stationSettings = async () => null;
    });

    expect(await configs.live(STATION.lineId, STATION.stationId)).toBeNull();
  });

  it('writes a valid candidate as the line would', async () => {
    const validated = await configsWith(() => {}).validate(
      STATION.lineId,
      STATION.stationId,
      BLOCK,
    );

    expect(validated?.ok && validated.block.value).toMatchObject(BLOCK);
  });

  it('passes on the problems Work found without asking the line', async () => {
    let asked = false;
    const configs = configsWith((lines, candidates) => {
      candidates.validate = async () => ({ ok: false, problems: [] });
      lines.candidateBlock = async () => {
        asked = true;
        return null;
      };
    });

    expect(
      await configs.validate(STATION.lineId, STATION.stationId, BLOCK),
    ).toEqual({ ok: false, problems: [] });
    expect(asked).toBe(false);
  });
});
