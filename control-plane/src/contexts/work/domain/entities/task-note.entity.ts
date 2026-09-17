import { unread } from '@work/domain/services/unread';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { NotePosition } from '@work/domain/value-objects/note-position.vo';
import type { Remark } from '@work/domain/value-objects/remark.vo';
import type { Said } from '@work/domain/value-objects/said.vo';
import type { StationName } from '@work/domain/value-objects/station-name.vo';
import type { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import type { Voice } from '@work/domain/value-objects/voice.vo';

export const TASK_NOTE_KINDS = ['asked', 'passed', 'answered', 'said'] as const;

export type TaskNoteKind = (typeof TASK_NOTE_KINDS)[number];

export const TASK_NOTE_FORMS = ['words', 'setup', 'settled'] as const;

export type TaskNoteForm = (typeof TASK_NOTE_FORMS)[number];

export class TaskNote {
  private constructor(
    readonly position: NotePosition,
    readonly station: StationName,
    readonly body: TaskNoteBody,
    readonly at: Date,
    readonly voice: Voice,
    readonly said: Said | null,
    readonly answeredAt: Date | null,
    readonly kind: TaskNoteKind,
    readonly readAt: Date | null,
    readonly deliveredAt: Date | null,
    readonly form: TaskNoteForm,
    readonly attachments: readonly Attachment[],
  ) {}

  static of(input: {
    position: NotePosition;
    station: StationName;
    body: TaskNoteBody;
    at: Date;
    voice: Voice;
    said?: Said | null;
    answeredAt?: Date | null;
    kind: TaskNoteKind;
    readAt?: Date | null;
    deliveredAt?: Date | null;
    form?: TaskNoteForm;
    attachments?: readonly Attachment[];
  }): TaskNote {
    return new TaskNote(
      input.position,
      input.station,
      input.body,
      input.at,
      input.voice,
      input.said ?? null,
      input.answeredAt ?? null,
      input.kind,
      input.readAt ?? null,
      input.deliveredAt ?? null,
      input.form ?? 'words',
      input.attachments ?? [],
    );
  }

  equals(other: TaskNote): boolean {
    return this.position.equals(other.position);
  }

  get unread(): boolean {
    return unread(this);
  }

  get undelivered(): boolean {
    return (
      this.kind === 'said' && !this.voice.isStation && this.deliveredAt === null
    );
  }

  get remark(): Remark | null {
    return this.said?.remark ?? null;
  }

  get open(): boolean {
    return this.remark !== null && this.answeredAt === null;
  }

  answered(at: Date): TaskNote {
    return this.open ? this.with({ answeredAt: at }) : this;
  }

  delivered(at: Date): TaskNote {
    return this.undelivered ? this.with({ deliveredAt: at }) : this;
  }

  read(at: Date): TaskNote {
    return this.unread ? this.with({ readAt: at }) : this;
  }

  private with(part: {
    readAt?: Date;
    deliveredAt?: Date;
    answeredAt?: Date;
  }): TaskNote {
    return new TaskNote(
      this.position,
      this.station,
      this.body,
      this.at,
      this.voice,
      this.said,
      part.answeredAt ?? this.answeredAt,
      this.kind,
      part.readAt ?? this.readAt,
      part.deliveredAt ?? this.deliveredAt,
      this.form,
      this.attachments,
    );
  }
}
