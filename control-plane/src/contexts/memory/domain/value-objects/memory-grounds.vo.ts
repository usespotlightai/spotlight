import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const MAX_CITED = 20;

const cited = (raw: readonly number[], what: string): number[] => {
  const kept = [...new Set(raw)].sort((a, b) => a - b);

  if (
    kept.length > MAX_CITED ||
    kept.some((each) => !Number.isInteger(each) || each < 0)
  ) {
    throw new InvalidMemoryError(`cites at most ${MAX_CITED} ${what}`);
  }

  return kept;
};

export class MemoryGrounds {
  private constructor(
    readonly taskId: TaskId,
    readonly runId: RunId,
    readonly steps: readonly number[],
    readonly notes: readonly number[],
  ) {}

  static of(input: {
    taskId: TaskId;
    runId: RunId;
    steps: readonly number[];
    notes: readonly number[];
  }): MemoryGrounds {
    const steps = cited(input.steps, 'steps of the run it was drafted from');
    const notes = cited(input.notes, 'notes of its task');

    if (steps.length === 0 && notes.length === 0) {
      throw new InvalidMemoryError(
        'rests on at least one step of its run or note of its task',
      );
    }

    return new MemoryGrounds(input.taskId, input.runId, steps, notes);
  }

  get onlyNotes(): boolean {
    return this.steps.length === 0;
  }

  equals(other: MemoryGrounds): boolean {
    return (
      this.taskId.equals(other.taskId) &&
      this.runId.equals(other.runId) &&
      this.steps.join() === other.steps.join() &&
      this.notes.join() === other.notes.join()
    );
  }
}
