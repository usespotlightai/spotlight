import { ContinuityKey } from '@domain/services/continuity-key';
import { describe, expect, it } from 'vitest';

describe('ContinuityKey', () => {
  it('names a directory for a task at a station', () => {
    expect(
      ContinuityKey.for({ taskId: 'task_1', stationId: 'station_2' }),
    ).toBe('task_1-station_2');
  });

  it('is the same for every run while the task stands there', () => {
    const here = ContinuityKey.for({
      taskId: 'task_1',
      stationId: 'station_2',
    });

    expect(
      ContinuityKey.for({ taskId: 'task_1', stationId: 'station_2' }),
    ).toBe(here);
    expect(
      ContinuityKey.for({ taskId: 'task_1', stationId: 'station_3' }),
    ).not.toBe(here);
  });
});
