import { unread } from '@domain/services/unread';
import type { StationName } from '@domain/value-objects/station-name.vo';
import type { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import type { Voice } from '@domain/value-objects/voice.vo';

export const TASK_NOTE_KINDS = ['asked', 'passed', 'answered', 'said'] as const;

/** What a note did: put the task to a person, settled it, or said a thing. */
export type TaskNoteKind = (typeof TASK_NOTE_KINDS)[number];

export class TaskNote {
  private constructor(
    readonly station: StationName,
    readonly body: TaskNoteBody,
    readonly at: Date,
    readonly voice: Voice,
    // An 'asked' opens a conversation a person owns; a 'passed' closes it.
    readonly kind: TaskNoteKind,
    readonly readAt: Date | null,
    // When it was handed to the agent working the task.
    readonly deliveredAt: Date | null,
  ) {}

  static of(input: {
    station: StationName;
    body: TaskNoteBody;
    at: Date;
    voice: Voice;
    kind: TaskNoteKind;
    readAt?: Date | null;
    deliveredAt?: Date | null;
  }): TaskNote {
    return new TaskNote(
      input.station,
      input.body,
      input.at,
      input.voice,
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
    return this.kind === 'said' && this.deliveredAt === null;
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
      this.voice,
      this.kind,
      part.readAt ?? this.readAt,
      part.deliveredAt ?? this.deliveredAt,
    );
  }
}
