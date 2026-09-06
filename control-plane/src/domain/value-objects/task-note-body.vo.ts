import { InvalidTaskNoteError } from '@domain/exceptions/invalid-task-note.error';
import type { Said } from '@domain/value-objects/said.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';

export class TaskNoteBody {
  private constructor(readonly value: string) {}

  static of(raw: string): TaskNoteBody {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidTaskNoteError('must not be empty');
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
