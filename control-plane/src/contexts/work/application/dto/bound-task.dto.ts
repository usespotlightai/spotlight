interface WaitingDto {
  readonly conversationId: string;
  readonly said: string;
  readonly awaitsApproval: boolean;
}

export interface BoundTaskDto {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly line: string;
  readonly station: string;
  readonly stationKey: string;
  readonly marks: Readonly<Record<string, string>>;
  readonly waiting: WaitingDto | null;
}
