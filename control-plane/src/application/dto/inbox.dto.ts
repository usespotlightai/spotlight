import {
  TASK_NOTE_FORMS,
  TASK_NOTE_KINDS,
} from '@domain/value-objects/task-note.vo';
import { VOICES } from '@domain/value-objects/voice.vo';

export const NOTE_KINDS = TASK_NOTE_KINDS;
export const NOTE_FORMS = TASK_NOTE_FORMS;
export const NOTE_VOICES = VOICES;

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
  readonly at: string;
  readonly author: InboxAuthorDto | null;
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
