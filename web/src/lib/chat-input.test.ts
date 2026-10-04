import { describe, expect, it } from 'vitest';
import { type Reference, stationImprovedBy } from '@/lib/chat-input';

const SPEC: Reference = { kind: 'station', key: 'station_spec', name: 'Spec' };
const REVIEW: Reference = {
  kind: 'station',
  key: 'station_review',
  name: 'Code Review',
};
const RETRIES: Reference = { kind: 'trace', key: 'task_1', name: 'Retries' };

describe('stationImprovedBy', () => {
  it('improves no station when the message names none', () => {
    expect(stationImprovedBy([RETRIES])).toBeNull();
  });

  it('improves the station the message names', () => {
    expect(stationImprovedBy([RETRIES, SPEC])).toBe('station_spec');
  });

  it('improves only one station, the first the message names', () => {
    expect(stationImprovedBy([SPEC, REVIEW])).toBe('station_spec');
  });
});
