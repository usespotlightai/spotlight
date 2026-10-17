import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { AttachmentSummary } from '@work/application/ports/attachment-reader.port';
import type {
  TaskNoteForm,
  TaskNoteKind,
} from '@work/domain/entities/task-note.entity';
import type { ApprovalStatus } from '@work/domain/value-objects/approval.vo';
import type { ApprovalSubjectKind } from '@work/domain/value-objects/approval-subject.vo';
import type { AsideForm } from '@work/domain/value-objects/aside-form';
import type { NoticeForm } from '@work/domain/value-objects/notice-form';
import type { SpokenBy } from '@work/domain/value-objects/voice.vo';

interface InboxAuthor {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

interface InboxPerson {
  readonly id: string;
  readonly name: string;
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
  readonly status: ApprovalStatus;
  readonly edited: readonly InboxApprovalInput[] | null;
  readonly intent: string | null;
  readonly askedOf: InboxPerson | null;
}

export interface InboxConnection {
  readonly source: string;
  readonly integration: string;
  readonly personId: string;
  readonly personName: string;
  readonly met: boolean;
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
  readonly connection: InboxConnection | null;
}

interface InboxAside {
  readonly form: AsideForm;
  readonly about: string;
}

interface InboxStation {
  readonly name: string;
  readonly color: string;
  readonly position: number;
}

export interface InboxItemSummary {
  readonly kind: 'task';
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
  readonly currentStation: InboxStation;
  readonly createdAt: Date;
  readonly askedAt: Date;
  readonly resolved: boolean;
  readonly working: boolean;
  readonly runId: string | null;
  readonly unread: boolean;
  readonly briefing: string | null;
  readonly failure: InboxFailure | null;
  readonly aside: InboxAside | null;
  readonly notes: readonly InboxNote[];
}

export interface InboxNoticeSummary {
  readonly kind: 'notice';
  readonly id: string;
  readonly teamId: string;
  readonly form: NoticeForm;
  readonly headline: string;
  readonly points: readonly string[];
  readonly link: string;
  readonly linkLabel: string;
  readonly askedAt: Date;
  readonly unread: boolean;
  readonly resolved: boolean;
}

export type InboxEntrySummary = InboxItemSummary | InboxNoticeSummary;

export const INBOX_READER = Symbol('INBOX_READER');

export interface InboxReaderPort {
  listForWorkspaceMember(
    slug: string,
    userId: UserId,
    noticesSettledSince: Date,
  ): Promise<InboxEntrySummary[] | null>;
}
