import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { RunStep } from '@memory/domain/value-objects/run-step';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const MAX_CITED = 20;

const cited = (raw: readonly number[], what: string): number[] => {
  const unique = [...new Set(raw)].sort((a, b) => a - b);

  if (
    unique.length > MAX_CITED ||
    unique.some((each) => !Number.isInteger(each) || each < 0)
  ) {
    throw new InvalidMemoryError(`cites at most ${MAX_CITED} ${what}`);
  }

  return unique;
};

export class MemoryProvenance {
  private constructor(
    readonly taskId: TaskId,
    readonly runId: RunId,
    readonly steps: readonly number[],
    readonly notes: readonly number[],
    /**
     * Which of the commands of its one cited step made it, by position in that step. Null where it was not
     * recorded, as for what was proposed before it was, which then reads as the step does.
     */
    readonly command: number | null,
  ) {}

  static of(input: {
    taskId: TaskId;
    runId: RunId;
    steps: readonly number[];
    notes: readonly number[];
    command?: number | null;
  }): MemoryProvenance {
    const steps = cited(input.steps, 'steps of the run that proposed it');
    const notes = cited(input.notes, 'notes of its task');
    const command = input.command ?? null;

    if (steps.length === 0 && notes.length === 0) {
      throw new InvalidMemoryError(
        'cites at least one step of its run or note of its task',
      );
    }

    if (
      command !== null &&
      (steps.length !== 1 || !Number.isInteger(command) || command < 0)
    ) {
      throw new InvalidMemoryError(
        'names the command that made it only within the one step it cites',
      );
    }

    return new MemoryProvenance(
      input.taskId,
      input.runId,
      steps,
      notes,
      command,
    );
  }

  get onlyNotes(): boolean {
    return this.steps.length === 0;
  }

  /** Whether it cites the command at this position of a step: any of the step's where it names none. */
  cites(step: number, command: number): boolean {
    const chosen = this.chosen;

    return this.steps.includes(step) && (chosen === null || chosen === command);
  }

  /** What a person reads as where it came from in one of the steps it cites: the command that made it, or the step. */
  sourceIn(step: RunStep): string {
    const chosen = this.chosen;
    const [only] = this.steps;
    const command =
      chosen !== null && step.index === only ? step.commands[chosen] : null;

    return command?.text ?? step.text;
  }

  equals(other: MemoryProvenance): boolean {
    return (
      this.taskId.equals(other.taskId) &&
      this.runId.equals(other.runId) &&
      this.steps.join() === other.steps.join() &&
      this.notes.join() === other.notes.join() &&
      this.chosen === other.chosen
    );
  }

  /** The command it names, read as none where an event from before it named one carries no field for it. */
  private get chosen(): number | null {
    return this.command ?? null;
  }
}
