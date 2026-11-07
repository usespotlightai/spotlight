import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { Page, PageRequest } from '@work/application/dto/page.dto';
import type { AttachmentSummary } from '@work/application/ports/attachment-reader.port';
import type { InboxSection } from '@work/application/read-models/inbox-section';
import type {
  TaskNoteForm,
  TaskNoteKind,
} from '@work/domain/entities/task-note.entity';
import type { ApprovalStatus } from '@work/domain/value-objects/approval.vo';
import type { ApprovalSubjectKind } from '@work/domain/value-objects/approval-subject.vo';
import type { InboxRequestForm } from '@work/domain/value-objects/inbox-request-form';
import type { NoticeForm } from '@work/domain/value-objects/notice-form';
import type { Progress } from '@work/domain/value-objects/run-state';
import type { AuthorKind } from '@work/domain/value-objects/voice.vo';

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
  readonly integration: string;
  readonly integrationName: string;
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
  readonly voice: AuthorKind;
  readonly station: string;
  readonly stationId: string;
  readonly stationColor: string;
  readonly stationPosition: number;
  readonly runId: string | null;
  readonly body: string;
  readonly attachments: readonly AttachmentSummary[];
  readonly at: Date;
  readonly author: InboxAuthor | null;
  readonly coAuthors: readonly InboxAuthor[];
  readonly readAt: Date | null;
  readonly approval: InboxApproval | null;
  readonly failure: InboxFailure | null;
  readonly connection: InboxConnection | null;
}

interface InboxRequestView {
  readonly form: InboxRequestForm;
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
  readonly originStation: InboxStation;
  readonly currentStation: InboxStation;
  readonly createdAt: Date;
  readonly askedAt: Date;
  readonly resolved: boolean;
  readonly section: InboxSection;
  readonly reopenable: boolean;
  readonly progress: Progress | null;
  readonly runId: string | null;
  readonly unread: boolean;
  readonly briefing: string | null;
  readonly failure: InboxFailure | null;
  readonly inboxRequest: InboxRequestView | null;
  readonly lastNote: InboxNote | null;
}

export interface InboxItemView extends InboxItemSummary {
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
  readonly externalLink: {
    readonly url: string;
    readonly label: string;
  } | null;
  readonly askedAt: Date;
  readonly unread: boolean;
  readonly resolved: boolean;
  readonly section: InboxSection;
  readonly reopenable: boolean;
}

export interface InboxRunSummary {
  readonly kind: 'run';
  readonly id: string;
  readonly taskId: string;
  readonly teamId: string;
  readonly title: string;
  readonly station: string;
  readonly stationColor: string;
  readonly stationPosition: number;
  readonly stationCount: number;
  readonly progress: Progress;
  readonly askedAt: Date;
  readonly unread: false;
  readonly resolved: false;
  readonly section: InboxSection;
  readonly reopenable: false;
}

export type InboxEntrySummary =
  | InboxItemSummary
  | InboxNoticeSummary
  | InboxRunSummary;

export const INBOX_READER = Symbol('INBOX_READER');

export interface InboxScope {
  readonly workspaceId: string;
  readonly viewer: UserId;
  readonly teamsSeen: ReadonlySet<string>;
  readonly teamsRead: ReadonlySet<string>;
}

export interface InboxReaderPort {
  open(scope: InboxScope): Promise<InboxEntrySummary[]>;

  resolved(
    scope: InboxScope,
    page: PageRequest,
  ): Promise<Page<InboxEntrySummary>>;

  item(scope: InboxScope, itemId: string): Promise<InboxItemView | null>;

  notice(
    scope: InboxScope,
    noticeId: string,
  ): Promise<InboxNoticeSummary | null>;
}
