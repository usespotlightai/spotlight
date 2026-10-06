import {
  candidateKindOf,
  LIVE_FINGERPRINT,
  later,
  possibleOf,
  SEARCH_ID,
  STATION,
  startAt,
} from '@replays/domain/replays.fake-spec';
import {
  ConfigOrigin,
  type PossibleOrigin,
} from '@replays/domain/value-objects/config-origin.vo';
import { describe, expect, it } from 'vitest';

const [proposed] = possibleOf(
  candidateKindOf({ kind: 'proposed', id: 'candidate_proposed' }),
) as [PossibleOrigin];

describe('ConfigOrigin', () => {
  it('names the candidate and the stretch start it is credited for', () => {
    const [searched] = possibleOf(
      candidateKindOf({ kind: 'searched', id: 'candidate_searched' }),
    ) as [PossibleOrigin];
    const origin = ConfigOrigin.credited(startAt(later(5)), searched);

    expect(origin).toMatchObject({
      lineId: STATION.lineId,
      stationId: STATION.stationId,
      changedAt: later(5),
      withdrawn: false,
      candidate: {
        name: { value: 'candidate-searched' },
        kind: 'searched',
        searchId: SEARCH_ID,
        createdAt: later(0),
      },
    });
  });

  it.each([
    ['made after the station changed to its config', startAt(later(-1))],
    ['at another station', startAt(later(1), { stationId: 'station_review' })],
    [
      'with another config',
      startAt(later(1), { fingerprint: LIVE_FINGERPRINT }),
    ],
  ])('refuses to credit a candidate %s', (_, start) => {
    expect(ConfigOrigin.mayHaveMade(proposed, start)).toBe(false);
    expect(() => ConfigOrigin.credited(start, proposed)).toThrow(
      expect.objectContaining({
        name: 'InvalidConfigOriginError',
        violation: 'invalid',
      }),
    );
  });
});
