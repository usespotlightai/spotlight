import { stationLabelOf } from '@work/presentation/http/mappers/station-label';
import { describe, expect, it } from 'vitest';

describe('stationLabelOf', () => {
  it('shows the station name', () => {
    expect(stationLabelOf('Triage')).toBe('Triage');
  });

  it('shows a neutral label for a note of no named station', () => {
    expect(stationLabelOf(null)).toBe('Station');
  });
});
