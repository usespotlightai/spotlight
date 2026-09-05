import { InvalidTaskNoteError } from '@domain/exceptions/invalid-task-note.error';
import type { Said } from '@domain/value-objects/said.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';

/** How long a note may be. Told to the runner, so an agent hears it early. */
export const TASK_NOTE_MAX_LENGTH = 4_000;

const MAX_LENGTH = TASK_NOTE_MAX_LENGTH;

export class TaskNoteBody {
  private constructor(readonly value: string) {}

  static of(raw: string): TaskNoteBody {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidTaskNoteError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidTaskNoteError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new TaskNoteBody(trimmed);
  }

  /** Told in the source's own words, which travel with the word itself. */
  static heard(told: string, said: Said | null): TaskNoteBody {
    // The place labels what was said, so the two stay together.
    const remark = [said?.place, said?.body].filter(Boolean).join('\n');

    return TaskNoteBody.of([told, remark].filter(Boolean).join('\n\n'));
  }

  static movedTo(station: StationName): TaskNoteBody {
    return TaskNoteBody.of(`Moved to ${station.value}.`);
  }

  equals(other: TaskNoteBody): boolean {
    return this.value === other.value;
  }
}
