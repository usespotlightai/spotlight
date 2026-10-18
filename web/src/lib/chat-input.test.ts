import { describe, expect, it } from 'vitest';
import { type Reference, targetStationIdIn } from '@/lib/chat-input';

const SPEC: Reference = { kind: 'station', key: 'station_spec', name: 'Spec' };
const REVIEW: Reference = {
  kind: 'station',
  key: 'station_review',
  name: 'Code Review',
};
const RETRIES: Reference = { kind: 'trace', key: 'task_1', name: 'Retries' };

describe('targetStationIdIn', () => {
  it('improves no station when the message names none', () => {
    expect(targetStationIdIn([RETRIES])).toBeNull();
  });

  it('improves the station the message names', () => {
    expect(targetStationIdIn([RETRIES, SPEC])).toBe('station_spec');
  });

  it('improves only one station, the first the message names', () => {
    expect(targetStationIdIn([SPEC, REVIEW])).toBe('station_spec');
  });
});
