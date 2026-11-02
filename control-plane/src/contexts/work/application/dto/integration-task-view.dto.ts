interface WaitingAttachmentDto {
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
}

interface WaitingDto {
  readonly conversationId: string;
  readonly body: string;
  readonly awaitsApproval: boolean;
  readonly attachments: readonly WaitingAttachmentDto[];
}

export interface IntegrationTaskViewDto {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly title: string;
  readonly pullRequest: string | null;
  readonly line: string;
  readonly station: string;
  readonly stationKey: string;
  readonly marks: Readonly<Record<string, string>>;
  readonly waiting: WaitingDto | null;
}
