import { STATION_CHANGE_REFUSALS } from '@replays/application/contracts/station-change-tests.contract';
import { stationChangeRefusalReason } from '@replays/application/rendering/station-change-refusals';
import { describe, expect, it } from 'vitest';

const NEXT_MONTH = new Date('2026-11-01T00:00:00.000Z');

describe('stationChangeRefusalReason', () => {
  it.each(STATION_CHANGE_REFUSALS)(
    'says in full sentences why %s stops a test',
    (refusal) => {
      const reason = stationChangeRefusalReason(refusal, NEXT_MONTH);

      expect(reason).toMatch(/^[A-Z]/);
      expect(reason).toMatch(/[.\d]$/);
    },
  );

  it('names the day the next month starts once the monthly ceiling is reached', () => {
    expect(stationChangeRefusalReason('monthly-ceiling', NEXT_MONTH)).toBe(
      'The searches of the line reached their monthly ceiling. Next month starts: 2026-11-01',
    );
  });

  it('says how often the judge agreed with itself and which claims changed most, when it knows', () => {
    expect(
      stationChangeRefusalReason('judge-unstable', NEXT_MONTH, {
        warning: { kind: 'judge-unstable', agreement: 13 / 18, compared: 18 },
        claimFlips: [
          { claim: 'Each finding is real.', flipped: 5 },
          { claim: 'Each finding says where it is.', flipped: 4 },
          { claim: 'A fault went back to Implementation.', flipped: 3 },
          { claim: 'The note is short.', flipped: 1 },
        ],
      }),
    ).toBe(
      'The judge of the station does not give the same verdict twice for the same run. Calibration judged 18 runs twice, and the two verdicts agreed for 13 of them (72%). Spotlight needs at least 80%. The claims whose result changed most between the two verdicts: “Each finding is real.” in 5 runs; “Each finding says where it is.” in 4 runs; “A fault went back to Implementation.” in 3 runs. Please make the claims of the judge more exact.',
    );
    expect(stationChangeRefusalReason('judge-unstable', NEXT_MONTH)).toBe(
      'The judge of the station does not give the same verdict twice for the same run. Please make the claims of the judge more exact.',
    );
  });
});
