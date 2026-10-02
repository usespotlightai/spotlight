import {
  type ReplayFacts,
  standingOf,
} from '@work/domain/services/replay-standing';
import { describe, expect, it } from 'vitest';

const REPLAYABLE: ReplayFacts = {
  runId: 'run_1',
  taskId: 'task_1',
  stationId: 'station_1',
  inWorkspace: true,
  ended: true,
  startedFrom: true,
  archive: 'kept',
  briefed: true,
  taskStands: true,
};

describe('standingOf', () => {
  it('finds nothing against an ended task run that said where it started and whose archive and task stand', () => {
    expect(standingOf(REPLAYABLE)).toBeNull();
    expect(standingOf({ ...REPLAYABLE, archive: 'none' })).toBeNull();
  });

  it.each([
    [null, 'unknown-run'],
    [{ ...REPLAYABLE, inWorkspace: false }, 'unknown-run'],
    [{ ...REPLAYABLE, taskId: null }, 'not-a-task-run'],
    [{ ...REPLAYABLE, ended: false }, 'still-running'],
    [{ ...REPLAYABLE, startedFrom: false }, 'no-starting-point'],
    [{ ...REPLAYABLE, briefed: false }, 'no-briefing'],
    [{ ...REPLAYABLE, taskStands: false }, 'task-gone'],
    [{ ...REPLAYABLE, archive: 'gone' as const }, 'archive-gone'],
  ])('refuses %o as %s', (facts, refusal) => {
    expect(standingOf(facts)?.refusal).toBe(refusal);
  });
});
