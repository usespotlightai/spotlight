import type { AttachmentDto } from '@work/application/dto/attachment.dto';
import {
  TASK_NOTE_FORMS,
  TASK_NOTE_KINDS,
} from '@work/domain/entities/task-note.entity';
import { APPROVAL_STANDINGS } from '@work/domain/value-objects/approval.vo';
import { VOICES } from '@work/domain/value-objects/voice.vo';

export const NOTE_KINDS = TASK_NOTE_KINDS;
export const NOTE_FORMS = TASK_NOTE_FORMS;
export const NOTE_VOICES = VOICES;
export const APPROVAL_STANDING = APPROVAL_STANDINGS;

export interface InboxApprovalInputDto {
  readonly name: string;
  readonly value: string;
}

export interface InboxApprovalDto {
  readonly tool: string;
  readonly because: string;
  readonly inputs: readonly InboxApprovalInputDto[];
  readonly standing: string;
}

export interface InboxAuthorDto {
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
}

export interface InboxStationDto {
  readonly name: string;
  readonly color: string;
  readonly position: number;
}

export interface InboxItemDto {
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
  readonly notes: readonly InboxMessageDto[];
}
