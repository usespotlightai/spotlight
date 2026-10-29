import { stationChangeRefusalReason } from '@replays/application/rendering/station-change-refusals';
import { STATION_CHANGE_REFUSALS } from '@work/application/ports/station-change-tests.port';
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
});
