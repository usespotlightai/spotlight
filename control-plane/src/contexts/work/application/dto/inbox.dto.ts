import type { AttachmentDto } from '@work/application/dto/attachment.dto';
import {
  TASK_NOTE_FORMS,
  TASK_NOTE_KINDS,
} from '@work/domain/entities/task-note.entity';
import { APPROVAL_STANDINGS } from '@work/domain/value-objects/approval.vo';
import {
  APPROVAL_SUBJECT_KINDS,
  type ApprovalSubjectKind,
} from '@work/domain/value-objects/approval-subject.vo';
import { ASIDE_FORMS } from '@work/domain/value-objects/aside-form';
import { NOTICE_FORMS } from '@work/domain/value-objects/notice-form';
import { VOICES } from '@work/domain/value-objects/voice.vo';

export const NOTE_KINDS = TASK_NOTE_KINDS;
export const NOTE_FORMS = TASK_NOTE_FORMS;
export const NOTE_VOICES = VOICES;
export const APPROVAL_STANDING = APPROVAL_STANDINGS;
export const APPROVAL_SUBJECTS = APPROVAL_SUBJECT_KINDS;
export const INBOX_ASIDE_FORMS = ASIDE_FORMS;
export const INBOX_NOTICE_FORMS = NOTICE_FORMS;

interface InboxApprovalInputDto {
  readonly name: string;
  readonly value: string;
}

export interface InboxApprovalDto {
  readonly kind: ApprovalSubjectKind;
  readonly name: string;
  readonly because: string;
  readonly inputs: readonly InboxApprovalInputDto[];
  readonly standing: string;
  readonly edited: readonly InboxApprovalInputDto[] | null;
  readonly intent: string | null;
  readonly askedOf: { readonly id: string; readonly name: string } | null;
}

export interface InboxConnectionDto {
  readonly source: string;
  readonly integration: string;
  readonly personId: string;
  readonly personName: string;
  readonly met: boolean;
}

export interface InboxFailureDto {
  readonly source: string;
  readonly code: string;
  readonly occurrences: number;
}

export interface InboxAsideDto {
  readonly form: string;
  readonly about: string;
}

interface InboxAuthorDto {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

export interface InboxMessageDto {
  readonly position: number;
  readonly kind: string;
  readonly form: string;
  readonly voice: string;
  readonly station: string;
  readonly stationColor: string;
  readonly stationPosition: number;
  readonly runId: string | null;
  readonly body: string;
  readonly attachments: readonly AttachmentDto[];
  readonly at: string;
  readonly author: InboxAuthorDto | null;
  readonly approval: InboxApprovalDto | null;
  readonly failure: InboxFailureDto | null;
  readonly connection: InboxConnectionDto | null;
}

interface InboxStationDto {
  readonly name: string;
  readonly color: string;
  readonly position: number;
}

export interface InboxItemDto {
  readonly kind: 'task';
  readonly id: string;
  readonly taskId: string;
  readonly teamId: string;
  readonly title: string;
  readonly description: string | null;
  readonly attachments: readonly AttachmentDto[];
  readonly station: string;
  readonly stationColor: string;
  readonly stationPosition: number;
  readonly stationCount: number;
  readonly raisedAt: InboxStationDto;
  readonly standsAt: InboxStationDto;
  readonly createdAt: string;
  readonly askedAt: string;
  readonly resolved: boolean;
  readonly working: boolean;
  readonly runId: string | null;
  readonly unread: boolean;
  readonly briefing: string | null;
  readonly failure: InboxFailureDto | null;
  readonly aside: InboxAsideDto | null;
  readonly notes: readonly InboxMessageDto[];
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
  readonly askedAt: string;
  readonly unread: boolean;
  readonly resolved: boolean;
}

export type InboxEntryDto = InboxItemDto | InboxNoticeDto;
