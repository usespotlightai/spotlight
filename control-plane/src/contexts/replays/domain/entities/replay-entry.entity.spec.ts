import { ReplayEntry } from '@replays/domain/entities/replay-entry.entity';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const stored = (run: RunId | null, slot: number | null) =>
  ReplayEntry.rehydrate({
    position: 0,
    original: RunId.of('original_0'),
    taskId: TaskId.of('task_0'),
    repeat: 1,
    run,
    slot,
    queued: false,
    fingerprint: null,
    queueAttempts: 0,
    unreplayableReason: null,
    notRun: false,
    end: null,
    measures: null,
    checks: null,
    judging: null,
    generationSpent: null,
    succeeded: null,
    reasons: [],
    secondJudging: null,
    recheck: null,
    pairing: null,
  });

describe('ReplayEntry', () => {
  it('loads an entry that occupies a runner only with the run slot it holds', () => {
    expect(stored(RunId.of('run_0'), 1).slot).toBe(1);
    expect(() => stored(RunId.of('run_0'), null)).toThrow(
      InconsistentStateError,
    );
  });

  it('refuses a run slot that is no pool position', () => {
    expect(() => stored(RunId.of('run_0'), -1)).toThrow(InconsistentStateError);
    expect(() => stored(RunId.of('run_0'), 0.5)).toThrow(
      InconsistentStateError,
    );
  });
});
