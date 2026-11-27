import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const provenance = (steps: readonly number[], command: number | null) =>
  MemoryProvenance.of({
    taskId: TaskId.of('task_1'),
    runId: RunId.of('run_1'),
    steps,
    notes: [],
    command,
  });

const STEP = {
  index: 3,
  kind: 'remember',
  text: 'spotlight remember --body One',
  commands: [
    {
      proposes: 'memory' as const,
      carrying: 'One',
      text: 'spotlight remember --body One',
    },
    {
      proposes: 'memory' as const,
      carrying: 'Two',
      text: 'spotlight remember --body Two',
    },
  ],
};

describe('MemoryProvenance', () => {
  it('names the command that made it only within the one step it cites', () => {
    expect(provenance([3], 1).command).toBe(1);
    expect(provenance([3], null).command).toBeNull();
    expect(() => provenance([3, 4], 0)).toThrow(InvalidMemoryError);
    expect(() => provenance([3], -1)).toThrow(InvalidMemoryError);
    expect(() => provenance([3], 0.5)).toThrow(InvalidMemoryError);
  });

  it('cites the command it names of its step, or every command of a step where it names none', () => {
    expect(provenance([3], 1).cites(3, 1)).toBe(true);
    expect(provenance([3], 1).cites(3, 0)).toBe(false);
    expect(provenance([3], 1).cites(4, 1)).toBe(false);
    expect(provenance([3], null).cites(3, 0)).toBe(true);
    expect(provenance([3], null).cites(3, 1)).toBe(true);
  });

  it('reads as the command it names, or as the step where it names none', () => {
    expect(provenance([3], 1).sourceIn(STEP)).toBe(
      'spotlight remember --body Two',
    );
    expect(provenance([3], null).sourceIn(STEP)).toBe(STEP.text);
  });

  it('reads as the step where an event from before it named a command carries no field for it', () => {
    const decoded = Object.assign(
      Object.create(MemoryProvenance.prototype) as MemoryProvenance,
      {
        taskId: TaskId.of('task_1'),
        runId: RunId.of('run_1'),
        steps: [3],
        notes: [],
      },
    );

    expect(decoded.sourceIn(STEP)).toBe(STEP.text);
    expect(decoded.cites(3, 1)).toBe(true);
    expect(decoded.equals(provenance([3], null))).toBe(true);
  });
});
