export interface InboxAuthorDto {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

/** One thing said about a task, as the inbox reads it: a message. */
export interface InboxMessageDto {
  readonly position: number;
  readonly kind: string;
  readonly station: string;
  readonly stationColor: string;
  readonly stationPosition: number;
  readonly runId: string | null;
  readonly body: string;
  readonly at: string;
  readonly author: InboxAuthorDto | null;
}

export interface InboxRaisedAtDto {
  readonly station: string;
  readonly stationColor: string;
  readonly stationPosition: number;
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
  readonly raisedAt: InboxRaisedAtDto;
  readonly createdAt: string;
  readonly askedAt: string;
  readonly resolved: boolean;
  readonly working: boolean;
  readonly unread: boolean;
  readonly notes: readonly InboxMessageDto[];
}
