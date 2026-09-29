import { unread } from '@work/domain/services/unread';
import type {
  Approval,
  ApprovalDecision,
  Decided,
} from '@work/domain/value-objects/approval.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { HeldBack } from '@work/domain/value-objects/held-back.vo';
import type { NotePosition } from '@work/domain/value-objects/note-position.vo';
import type { Remark } from '@work/domain/value-objects/remark.vo';
import type { Said } from '@work/domain/value-objects/said.vo';
import type { StationName } from '@work/domain/value-objects/station-name.vo';
import type { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import type { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import type { Voice } from '@work/domain/value-objects/voice.vo';

export const TASK_NOTE_KINDS = ['asked', 'passed', 'answered', 'said'] as const;

export type TaskNoteKind = (typeof TASK_NOTE_KINDS)[number];

export const TASK_NOTE_FORMS = [
  'words',
  'setup',
  'settled',
  'approval',
  'failure',
] as const;

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
    readonly approval: Approval | null,
    readonly failure: TaskFailure | null,
    readonly heldBack: HeldBack | null,
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
    approval?: Approval | null;
    failure?: TaskFailure | null;
    heldBack?: HeldBack | null;
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
      input.approval ?? null,
      input.failure ?? null,
      input.heldBack ?? null,
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
      (this.kind === 'said' || this.kind === 'answered') &&
      !this.voice.isStation &&
      this.deliveredAt === null
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

  decided(decision: ApprovalDecision, decided: Decided): TaskNote {
    return this.approval
      ? this.with({ approval: this.approval.decide(decision, decided) })
      : this;
  }

  approvalClaimed(): TaskNote {
    return this.approval
      ? this.with({ approval: this.approval.claimed() })
      : this;
  }

  approvalReturned(): TaskNote {
    return this.approval
      ? this.with({ approval: this.approval.returned() })
      : this;
  }

  recurred(): TaskNote {
    return this.failure
      ? new TaskNote(
          this.position,
          this.station,
          this.body,
          this.at,
          this.voice,
          this.said,
          this.answeredAt,
          this.kind,
          null,
          this.deliveredAt,
          this.form,
          this.attachments,
          this.approval,
          this.failure.again(),
          this.heldBack,
        )
      : this;
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
    approval?: Approval;
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
      part.approval ?? this.approval,
      this.failure,
      this.heldBack,
    );
  }
}
