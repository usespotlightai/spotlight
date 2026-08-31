import { InvalidTaskNoteError } from '@domain/exceptions/invalid-task-note.error';
import { unread } from '@domain/services/unread';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
import type { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

/** What a note did: put the task to a person, moved it on, or answered. */
export type TaskNoteKind =
  | 'asked'
  | 'passed'
  | 'answered'
  | 'said'
  | 'closed'
  | 'heard';

export class TaskNote {
  private constructor(
    readonly station: StationName,
    readonly body: TaskNoteBody,
    readonly at: Date,
    // Who said it. Absent is the station speaking, which is what every note
    // was until a person could answer one.
    readonly author: UserId | null,
    // The run whose ending wrote it, where one did. What the agent did to
    // arrive at it is that run's journal.
    readonly run: RunId | null,
    // An 'asked' opens a conversation a person owns; a 'passed' closes it.
    readonly kind: TaskNoteKind,
    readonly readAt: Date | null,
    // When it was handed to the agent working the task. Only what a person
    // said to one is ever waiting to be delivered.
    readonly deliveredAt: Date | null,
  ) {}

  static of(input: {
    station: StationName;
    body: TaskNoteBody;
    at: Date;
    author?: UserId | null;
    run?: RunId | null;
    kind: TaskNoteKind;
    readAt?: Date | null;
    deliveredAt?: Date | null;
  }): TaskNote {
    // Neither is the board moving a task, which is nobody speaking.
    if (input.author && input.run) {
      throw new InvalidTaskNoteError(
        'is said by a person or by a run, never by both',
      );
    }

    return new TaskNote(
      input.station,
      input.body,
      input.at,
      input.author ?? null,
      input.run ?? null,
      input.kind,
      input.readAt ?? null,
      input.deliveredAt ?? null,
    );
  }

  get unread(): boolean {
    return unread(this);
  }

  /** A person speaking and the world happening both interrupt a run. */
  get undelivered(): boolean {
    return (
      (this.kind === 'said' || this.kind === 'heard') &&
      this.deliveredAt === null
    );
  }

  delivered(at: Date): TaskNote {
    return this.undelivered ? this.with({ deliveredAt: at }) : this;
  }

  read(at: Date): TaskNote {
    return this.unread ? this.with({ readAt: at }) : this;
  }

  private with(part: { readAt?: Date; deliveredAt?: Date }): TaskNote {
    return new TaskNote(
      this.station,
      this.body,
      this.at,
      this.author,
      this.run,
      this.kind,
      part.readAt ?? this.readAt,
      part.deliveredAt ?? this.deliveredAt,
    );
  }
}
