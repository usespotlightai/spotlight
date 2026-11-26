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

  it('says when the request limit resets and which setting raises it', () => {
    expect(
      stationChangeRefusalReason('request-limit', NEXT_MONTH, {
        requestLimit: {
          perDay: 3,
          resetsAt: new Date('2026-10-30T00:00:00.000Z'),
        },
      }),
    ).toBe(
      'The station took the most requested tests for today. Maximum requests a day: 3. The count resets at 2026-10-30 00:00 UTC. To allow more, set requests_per_day in the search block of the station or of the line in Terraform.',
    );
  });
});
