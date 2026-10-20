import { unread } from '@work/domain/services/unread';
import type { Anchor } from '@work/domain/value-objects/anchor.vo';
import type {
  Approval,
  ApprovalDecision,
  ApprovalEdits,
  Decided,
} from '@work/domain/value-objects/approval.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { ConnectionAsk } from '@work/domain/value-objects/connection-ask.vo';
import type { DeferredMove } from '@work/domain/value-objects/deferred-move.vo';
import type { NotePosition } from '@work/domain/value-objects/note-position.vo';
import type { ReviewComment } from '@work/domain/value-objects/review-comment.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { StationName } from '@work/domain/value-objects/station-name.vo';
import type { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import type { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import type { Voice } from '@work/domain/value-objects/voice.vo';

export const TASK_NOTE_KINDS = [
  'asked',
  'passed',
  'answered',
  'message',
] as const;

export type TaskNoteKind = (typeof TASK_NOTE_KINDS)[number];

export const TASK_NOTE_FORMS = [
  'words',
  'setup',
  'resolved',
  'approval',
  'failure',
  'connection',
] as const;

export type TaskNoteForm = (typeof TASK_NOTE_FORMS)[number];

export class TaskNote {
  private constructor(
    readonly position: NotePosition,
    readonly station: StationName,
    readonly stationId: StationId,
    readonly body: TaskNoteBody,
    readonly at: Date,
    readonly voice: Voice,
    readonly anchor: Anchor | null,
    readonly answeredAt: Date | null,
    readonly kind: TaskNoteKind,
    readonly readAt: Date | null,
    readonly acknowledgedAt: Date | null,
    readonly form: TaskNoteForm,
    readonly attachments: readonly Attachment[],
    readonly approval: Approval | null,
    readonly failure: TaskFailure | null,
    readonly deferredMove: DeferredMove | null,
    readonly connectionAsk: ConnectionAsk | null,
  ) {}

  static of(input: {
    position: NotePosition;
    station: StationName;
    stationId: StationId;
    body: TaskNoteBody;
    at: Date;
    voice: Voice;
    anchor?: Anchor | null;
    answeredAt?: Date | null;
    kind: TaskNoteKind;
    readAt?: Date | null;
    acknowledgedAt?: Date | null;
    form?: TaskNoteForm;
    attachments?: readonly Attachment[];
    approval?: Approval | null;
    failure?: TaskFailure | null;
    deferredMove?: DeferredMove | null;
    connectionAsk?: ConnectionAsk | null;
  }): TaskNote {
    return new TaskNote(
      input.position,
      input.station,
      input.stationId,
      input.body,
      input.at,
      input.voice,
      input.anchor ?? null,
      input.answeredAt ?? null,
      input.kind,
      input.readAt ?? null,
      input.acknowledgedAt ?? null,
      input.form ?? 'words',
      input.attachments ?? [],
      input.approval ?? null,
      input.failure ?? null,
      input.deferredMove ?? null,
      input.connectionAsk ?? null,
    );
  }

  equals(other: TaskNote): boolean {
    return this.position.equals(other.position);
  }

  get unread(): boolean {
    return unread(this);
  }

  get unacknowledged(): boolean {
    return (
      (this.kind === 'message' || this.kind === 'answered') &&
      !this.voice.isStation &&
      this.acknowledgedAt === null
    );
  }

  get reviewComment(): ReviewComment | null {
    return this.anchor?.reviewComment ?? null;
  }

  get open(): boolean {
    return this.reviewComment !== null && this.answeredAt === null;
  }

  answered(at: Date): TaskNote {
    return this.open ? this.with({ answeredAt: at }) : this;
  }

  decided(
    decision: ApprovalDecision,
    decided: Decided,
    edits: ApprovalEdits | null,
  ): TaskNote {
    return this.approval
      ? this.with({ approval: this.approval.decide(decision, decided, edits) })
      : this;
  }

  approvalClaimed(): TaskNote {
    return this.approval
      ? this.with({ approval: this.approval.claimed() })
      : this;
  }

  returnApproval(): TaskNote {
    return this.approval
      ? this.with({ approval: this.approval.returned() })
      : this;
  }

  connectionMet(): TaskNote {
    return this.connectionAsk
      ? this.with({ connectionAsk: this.connectionAsk.fulfilled() })
      : this;
  }

  recurred(as: TaskFailure): TaskNote {
    return this.failure
      ? new TaskNote(
          this.position,
          this.station,
          this.stationId,
          this.body,
          this.at,
          this.voice,
          this.anchor,
          this.answeredAt,
          this.kind,
          null,
          this.acknowledgedAt,
          this.form,
          this.attachments,
          this.approval,
          as,
          this.deferredMove,
          this.connectionAsk,
        )
      : this;
  }

  acknowledge(at: Date): TaskNote {
    return this.unacknowledged ? this.with({ acknowledgedAt: at }) : this;
  }

  read(at: Date): TaskNote {
    return this.unread ? this.with({ readAt: at }) : this;
  }

  private with(part: {
    readAt?: Date;
    acknowledgedAt?: Date;
    answeredAt?: Date;
    approval?: Approval;
    connectionAsk?: ConnectionAsk;
  }): TaskNote {
    return new TaskNote(
      this.position,
      this.station,
      this.stationId,
      this.body,
      this.at,
      this.voice,
      this.anchor,
      part.answeredAt ?? this.answeredAt,
      this.kind,
      part.readAt ?? this.readAt,
      part.acknowledgedAt ?? this.acknowledgedAt,
      this.form,
      this.attachments,
      part.approval ?? this.approval,
      this.failure,
      this.deferredMove,
      part.connectionAsk ?? this.connectionAsk,
    );
  }
}
