import { judgeOmittedFor } from '@insights/domain/services/agent-config-comparison';
import { describe, expect, it } from 'vitest';

describe('judgeOmittedFor', () => {
  it('compares judge scores only within one station, since each station’s judge scores against its own rubric', () => {
    expect(judgeOmittedFor(null)).toBe('no_station');
    expect(judgeOmittedFor('station_1')).toBeNull();
  });
});
