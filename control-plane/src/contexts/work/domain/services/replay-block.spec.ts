import {
  type ReplayFacts,
  replayBlockOf,
} from '@work/domain/services/replay-block';
import { describe, expect, it } from 'vitest';

const REPLAYABLE: ReplayFacts = {
  runId: 'run_1',
  taskId: 'task_1',
  stationId: 'station_1',
  inWorkspace: true,
  ended: true,
  startedFrom: true,
  archive: 'stored',
  briefed: true,
  taskExists: true,
};

describe('replayBlockOf', () => {
  it('finds nothing against an ended task run that said where it started and whose archive and task still exist', () => {
    expect(replayBlockOf(REPLAYABLE)).toBeNull();
    expect(replayBlockOf({ ...REPLAYABLE, archive: 'none' })).toBeNull();
  });

  it.each([
    [null, 'unknown-run'],
    [{ ...REPLAYABLE, inWorkspace: false }, 'unknown-run'],
    [{ ...REPLAYABLE, taskId: null }, 'not-a-task-run'],
    [{ ...REPLAYABLE, ended: false }, 'still-running'],
    [{ ...REPLAYABLE, startedFrom: false }, 'no-starting-point'],
    [{ ...REPLAYABLE, briefed: false }, 'no-briefing'],
    [{ ...REPLAYABLE, taskExists: false }, 'task-gone'],
    [{ ...REPLAYABLE, archive: 'gone' as const }, 'archive-gone'],
  ])('finds %o unreplayable as %s', (facts, unreplayableReason) => {
    expect(replayBlockOf(facts)?.unreplayableReason).toBe(unreplayableReason);
  });
});
