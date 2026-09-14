import { unread } from '@domain/services/unread';
import type { Attachment } from '@domain/value-objects/attachment.vo';
import type { Remark } from '@domain/value-objects/remark.vo';
import type { Said } from '@domain/value-objects/said.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
import type { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import type { Voice } from '@domain/value-objects/voice.vo';

export const TASK_NOTE_KINDS = ['asked', 'passed', 'answered', 'said'] as const;

export type TaskNoteKind = (typeof TASK_NOTE_KINDS)[number];

export const TASK_NOTE_FORMS = ['words', 'setup', 'settled'] as const;

export type TaskNoteForm = (typeof TASK_NOTE_FORMS)[number];

const sameMoment = (a: Date | null, b: Date | null): boolean =>
  a === null ? b === null : b !== null && a.getTime() === b.getTime();

export class TaskNote {
  private constructor(
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
    return (
      this.station.equals(other.station) &&
      this.body.equals(other.body) &&
      sameMoment(this.at, other.at) &&
      this.voice.equals(other.voice) &&
      (this.said === null
        ? other.said === null
        : other.said !== null && this.said.equals(other.said)) &&
      sameMoment(this.answeredAt, other.answeredAt) &&
      this.kind === other.kind &&
      sameMoment(this.readAt, other.readAt) &&
      sameMoment(this.deliveredAt, other.deliveredAt) &&
      this.form === other.form &&
      this.attachments.length === other.attachments.length &&
      this.attachments.every((each, at) =>
        each.equals(other.attachments[at] as Attachment),
      )
    );
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
