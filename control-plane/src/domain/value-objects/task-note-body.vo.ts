import { InvalidTaskNoteError } from '@domain/exceptions/invalid-task-note.error';
import type { Happening } from '@domain/value-objects/happening.vo';
import type { Said } from '@domain/value-objects/said.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';

const AS_TOLD: Record<Happening, string> = {
  merged: 'The pull request was merged.',
  commented: 'The pull request was commented on.',
  'changes-requested': 'Changes were requested on the pull request.',
  'checks-failed': 'The checks failed on the pull request.',
  'closed-unmerged': 'The pull request was closed without being merged.',
};

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

  static heard(happening: Happening, said: Said | null): TaskNoteBody {
    // The place labels what was said, so the two stay together.
    const remark = [said?.place, said?.body].filter(Boolean).join('\n');

    return TaskNoteBody.of(
      [AS_TOLD[happening], remark].filter(Boolean).join('\n\n'),
    );
  }

  static movedTo(station: StationName): TaskNoteBody {
    return TaskNoteBody.of(`Moved to ${station.value}.`);
  }

  equals(other: TaskNoteBody): boolean {
    return this.value === other.value;
  }
}
