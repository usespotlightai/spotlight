import type { AttachmentDto } from '@work/application/dto/attachment.dto';
import {
  INBOX_SECTIONS,
  type InboxSection,
} from '@work/application/read-models/inbox-section';
import {
  TASK_NOTE_FORMS,
  TASK_NOTE_KINDS,
} from '@work/domain/entities/task-note.entity';
import { APPROVAL_STATUSES } from '@work/domain/value-objects/approval.vo';
import {
  APPROVAL_SUBJECT_KINDS,
  type ApprovalSubjectKind,
} from '@work/domain/value-objects/approval-subject.vo';
import { INBOX_REQUEST_FORMS } from '@work/domain/value-objects/inbox-request-form';
import { NOTICE_FORMS } from '@work/domain/value-objects/notice-form';
import type { Progress } from '@work/domain/value-objects/progress';
import { VOICE_KINDS } from '@work/domain/value-objects/voice.vo';

export const NOTE_KINDS = TASK_NOTE_KINDS;
export const NOTE_FORMS = TASK_NOTE_FORMS;
export const NOTE_VOICES = VOICE_KINDS;
export const INBOX_APPROVAL_STATUSES = APPROVAL_STATUSES;
export const APPROVAL_SUBJECTS = APPROVAL_SUBJECT_KINDS;
export const INBOX_REQUEST_DTO_FORMS = INBOX_REQUEST_FORMS;
export const INBOX_NOTICE_FORMS = NOTICE_FORMS;
export const INBOX_DTO_SECTIONS = INBOX_SECTIONS;

export type InboxDtoSection = InboxSection;

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

export interface InboxRequestDto {
  readonly form: string;
  readonly about: string;
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
  readonly approval: InboxApprovalDto | null;
  readonly failure: InboxFailureDto | null;
  readonly connection: InboxConnectionDto | null;
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
  readonly reopenable: boolean;
  readonly progress: Progress | null;
  readonly runId: string | null;
  readonly unread: boolean;
  readonly briefing: string | null;
  readonly failure: InboxFailureDto | null;
  readonly inboxRequest: InboxRequestDto | null;
  readonly lastNote: NoteDto | null;
}

export interface InboxItemViewDto extends InboxItemDto {
  readonly notes: readonly NoteDto[];
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
  readonly resolved: boolean;
  readonly section: InboxSection;
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
  readonly resolved: false;
  readonly section: InboxSection;
  readonly reopenable: false;
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
  readonly resolved: boolean;
  readonly section: InboxSection;
  readonly reopenable: boolean;
}

export type InboxEntryDto =
  | InboxItemDto
  | InboxNoticeDto
  | InboxRunDto
  | InboxChatDto;
