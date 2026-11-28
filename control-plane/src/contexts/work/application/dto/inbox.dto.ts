import type { AttachmentDto } from '@work/application/dto/attachment.dto';
import {
  INBOX_SECTIONS,
  type InboxSection,
} from '@work/application/read-models/inbox-section';
import {
  TASK_NOTE_FORMS,
  TASK_NOTE_KINDS,
} from '@work/domain/entities/task-note.entity';
import {
  CONVERSATION_STANDINGS,
  type ConversationStanding,
  RUN_STANDINGS,
  type RunStanding,
} from '@work/domain/services/conversation-audience';
import {
  INBOX_PART_KINDS,
  type InboxPartKind,
} from '@work/domain/services/task-inbox';
import {
  APPROVAL_SUBJECT_KINDS,
  type ApprovalSubjectKind,
} from '@work/domain/value-objects/approval-subject.vo';
import { APPROVAL_STATUSES } from '@work/domain/value-objects/approval.vo';
import { HOLD_ENDS } from '@work/domain/value-objects/hold-end';
import { INBOX_REQUEST_FORMS } from '@work/domain/value-objects/inbox-request-form';
import { NOTICE_FORMS } from '@work/domain/value-objects/notice-form';
import type { Progress } from '@work/domain/value-objects/progress';
import { VOICE_KINDS } from '@work/domain/value-objects/voice.vo';

export const NOTE_KINDS = TASK_NOTE_KINDS;
export const NOTE_FORMS = TASK_NOTE_FORMS;
export const NOTE_VOICES = VOICE_KINDS;
export const NOTE_HOLD_ENDS = HOLD_ENDS;
export const INBOX_APPROVAL_STATUSES = APPROVAL_STATUSES;
export const APPROVAL_SUBJECTS = APPROVAL_SUBJECT_KINDS;
export const INBOX_REQUEST_DTO_FORMS = INBOX_REQUEST_FORMS;
export const INBOX_DTO_PART_KINDS = INBOX_PART_KINDS;
export const INBOX_NOTICE_FORMS = NOTICE_FORMS;
export const INBOX_DTO_SECTIONS = INBOX_SECTIONS;
export const INBOX_STANDINGS = CONVERSATION_STANDINGS;
export const INBOX_RUN_STANDINGS = RUN_STANDINGS;

export type InboxDtoSection = InboxSection;
export type InboxStanding = ConversationStanding;
export type InboxRunStanding = RunStanding;

interface InboxApprovalInputDto {
  readonly name: string;
  readonly value: string;
}

export interface InboxApprovalDto {
  readonly kind: ApprovalSubjectKind;
  readonly name: string;
  readonly because: string;
  readonly inputs: readonly InboxApprovalInputDto[];
  readonly status: string;
  readonly edited: readonly InboxApprovalInputDto[] | null;
  readonly intent: string | null;
  readonly askedOf: { readonly id: string; readonly name: string } | null;
}

export interface InboxConnectionDto {
  readonly integration: string;
  readonly integrationName: string;
  readonly personId: string;
  readonly personName: string;
  readonly met: boolean;
}

export interface InboxFailureDto {
  readonly source: string;
  readonly code: string;
  readonly occurrences: number;
}

export interface NoteResumptionDto {
  readonly next: string;
  readonly station: string;
  readonly summary: string | null;
}

export interface InboxPartDto {
  readonly id: string;
  readonly kind: InboxPartKind;
  readonly form: string | null;
  readonly about: string | null;
  readonly asks: number;
  readonly at: string;
  readonly open: boolean;
  readonly unread: boolean;
  readonly resolvable: boolean;
  readonly reopenable: boolean;
}

export interface InboxPartPreviewDto {
  readonly kind: InboxPartKind;
  readonly count: number;
}

export interface InboxFirstUnreadDto {
  readonly partId: string;
  readonly position: number | null;
}

interface InboxAuthorDto {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

export interface NoteDto {
  readonly position: number;
  readonly kind: string;
  readonly form: string;
  readonly voice: string;
  readonly station: string | null;
  readonly stationColor: string;
  readonly stationPosition: number;
  readonly runId: string | null;
  readonly body: string;
  readonly attachments: readonly AttachmentDto[];
  readonly at: string;
  readonly author: InboxAuthorDto | null;
  readonly coAuthors: readonly InboxAuthorDto[];
  readonly source: string | null;
  readonly deferredTo: string | null;
  readonly approval: InboxApprovalDto | null;
  readonly failure: InboxFailureDto | null;
  readonly connection: InboxConnectionDto | null;
  readonly resumption: NoteResumptionDto | null;
  readonly suggestsClosing: boolean;
}

interface InboxStationDto {
  readonly name: string | null;
  readonly color: string;
  readonly position: number;
}

interface InboxCurrentStationDto extends InboxStationDto {
  readonly latestRunId: string | null;
}

export interface InboxItemDto {
  readonly kind: 'task';
  readonly id: string;
  readonly taskId: string;
  readonly teamId: string;
  readonly title: string;
  readonly description: string | null;
  readonly attachments: readonly AttachmentDto[];
  readonly station: string | null;
  readonly stationColor: string;
  readonly stationPosition: number;
  readonly stationCount: number;
  readonly originStation: InboxStationDto;
  readonly currentStation: InboxCurrentStationDto;
  readonly createdAt: string;
  readonly askedAt: string;
  readonly resolved: boolean;
  readonly section: InboxSection;
  readonly standing: InboxStanding | null;
  readonly answerable: boolean;
  readonly resolvable: boolean;
  readonly reopenable: boolean;
  readonly progress: Progress | null;
  readonly runId: string | null;
  readonly stoppableByYou: boolean;
  readonly unread: boolean;
  readonly briefing: string | null;
  readonly failure: InboxFailureDto | null;
  readonly lastNote: NoteDto | null;
  readonly conversationId: string | null;
  readonly unreadCount: number;
  readonly latest: InboxPartPreviewDto | null;
  readonly quiet: boolean;
  readonly parts: readonly InboxPartDto[];
  readonly firstUnread: InboxFirstUnreadDto | null;
}

export interface FoldedVisitDto {
  readonly first: NoteDto;
  readonly to: number;
  readonly endedAt: string;
  readonly closing: NoteDto | null;
  readonly answers: readonly NoteDto[];
  readonly passedBack: boolean;
}

export interface InboxItemViewDto extends InboxItemDto {
  readonly notes: readonly NoteDto[];
  readonly folded: readonly FoldedVisitDto[];
}

export interface NoticeExternalLinkDto {
  readonly url: string;
  readonly label: string;
}

export interface InboxNoticeDto {
  readonly kind: 'notice';
  readonly id: string;
  readonly teamId: string;
  readonly form: string;
  readonly headline: string;
  readonly points: readonly string[];
  readonly link: string;
  readonly linkLabel: string;
  readonly externalLink: NoticeExternalLinkDto | null;
  readonly askedAt: string;
  readonly unread: boolean;
  readonly unreadCount: number;
  readonly resolved: boolean;
  readonly section: InboxSection;
  readonly resolvable: boolean;
  readonly reopenable: boolean;
}

export interface InboxRunDto {
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
  readonly askedAt: string;
  readonly unread: false;
  readonly unreadCount: 0;
  readonly resolved: false;
  readonly section: InboxSection;
  readonly standing: InboxRunStanding;
  readonly reopenable: false;
  readonly stoppableByYou: boolean;
}

export interface InboxChatDto {
  readonly kind: 'chat';
  readonly id: string;
  readonly teamId: string;
  readonly title: string;
  readonly progress: Progress | null;
  readonly openProposals: number;
  readonly askedAt: string;
  readonly unread: boolean;
  readonly unreadCount: number;
  readonly resolved: boolean;
  readonly section: InboxSection;
  readonly reopenable: boolean;
}

export type InboxEntryDto =
  | InboxItemDto
  | InboxNoticeDto
  | InboxRunDto
  | InboxChatDto;
