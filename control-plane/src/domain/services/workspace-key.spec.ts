import { WorkspaceKey } from '@domain/services/workspace-key';
import { describe, expect, it } from 'vitest';

describe('WorkspaceKey', () => {
  it('names a directory for a task at a station', () => {
    expect(WorkspaceKey.for({ taskId: 'task_1', stationId: 'station_2' })).toBe(
      'task_1-station_2',
    );
  });

  // Runs at one station share what the last one left; moving on does not.
  it('is the same for every run while the task stands there', () => {
    const here = WorkspaceKey.for({ taskId: 'task_1', stationId: 'station_2' });

    expect(WorkspaceKey.for({ taskId: 'task_1', stationId: 'station_2' })).toBe(
      here,
    );
    expect(
      WorkspaceKey.for({ taskId: 'task_1', stationId: 'station_3' }),
    ).not.toBe(here);
  });
});
