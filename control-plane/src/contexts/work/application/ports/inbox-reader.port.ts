import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { AttachmentSummary } from '@work/application/ports/attachment-reader.port';
import type {
  TaskNoteForm,
  TaskNoteKind,
} from '@work/domain/entities/task-note.entity';
import type { ApprovalStanding } from '@work/domain/value-objects/approval.vo';
import type { ApprovalSubjectKind } from '@work/domain/value-objects/approval-subject.vo';
import type { SpokenBy } from '@work/domain/value-objects/voice.vo';

interface InboxAuthor {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

interface InboxApprovalInput {
  readonly name: string;
  readonly value: string;
}

export interface InboxApproval {
  readonly kind: ApprovalSubjectKind;
  readonly name: string;
  readonly because: string;
  readonly inputs: readonly InboxApprovalInput[];
  readonly standing: ApprovalStanding;
}

export interface InboxFailure {
  readonly source: string;
  readonly code: string;
  readonly occurrences: number;
}

export interface InboxNote {
  readonly position: number;
  readonly kind: TaskNoteKind;
  readonly form: TaskNoteForm;
  readonly voice: SpokenBy;
  readonly station: string;
  readonly stationColor: string;
  readonly stationPosition: number;
  readonly runId: string | null;
  readonly body: string;
  readonly attachments: readonly AttachmentSummary[];
  readonly at: Date;
  readonly author: InboxAuthor | null;
  readonly readAt: Date | null;
  readonly approval: InboxApproval | null;
  readonly failure: InboxFailure | null;
}

interface InboxStation {
  readonly name: string;
  readonly color: string;
  readonly position: number;
}

export interface InboxItemSummary {
  readonly id: string;
  readonly taskId: string;
  readonly teamId: string;
  readonly title: string;
  readonly description: string | null;
  readonly attachments: readonly AttachmentSummary[];
  readonly station: string;
  readonly stationColor: string;
  readonly stationPosition: number;
  readonly stationCount: number;
  readonly raisedAt: InboxStation;
  readonly standsAt: InboxStation;
  readonly createdAt: Date;
  readonly askedAt: Date;
  readonly resolved: boolean;
  readonly working: boolean;
  readonly runId: string | null;
  readonly unread: boolean;
  readonly briefing: string | null;
  readonly failure: InboxFailure | null;
  readonly notes: readonly InboxNote[];
}

export const INBOX_READER = Symbol('INBOX_READER');

export interface InboxReaderPort {
  listForWorkspaceMember(
    slug: string,
    userId: UserId,
  ): Promise<InboxItemSummary[] | null>;
}
