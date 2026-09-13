import { InvalidTaskNoteError } from '@domain/exceptions/invalid-task-note.error';
import type { Attachment } from '@domain/value-objects/attachment.vo';
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

  static heard(told: string, said: Said | null): TaskNoteBody {
    const spoken = [said?.place, said?.body].filter(Boolean).join('\n');

    return TaskNoteBody.of(spoken || told);
  }

  static given(
    raw: string,
    attachments: readonly Attachment[] = [],
  ): TaskNoteBody {
    const names = attachments.map((each) => each.name).join(', ');

    return TaskNoteBody.of(raw.trim() || (names ? `Attached ${names}.` : ''));
  }

  static movedTo(station: StationName): TaskNoteBody {
    return TaskNoteBody.of(`Moved to ${station.value}.`);
  }

  equals(other: TaskNoteBody): boolean {
    return this.value === other.value;
  }
}
