import {
  LINE_DEFINITION_SEARCH_DEFAULTS,
  stationSearchDefaultsOf,
} from '@lines/application/contracts/line-definition.contract';
import { describe, expect, it } from 'vitest';

describe('stationSearchDefaultsOf', () => {
  it("gives a station the line's requests a day, and the default when the line has no search block", () => {
    expect(stationSearchDefaultsOf({ requestsPerDay: 5 })).toEqual({
      requestsPerDay: 5,
    });
    expect(stationSearchDefaultsOf({ cooldown: '1d' })).toEqual({
      requestsPerDay: LINE_DEFINITION_SEARCH_DEFAULTS.requestsPerDay,
    });
    expect(stationSearchDefaultsOf(undefined)).toEqual({
      requestsPerDay: 3,
    });
  });
});
