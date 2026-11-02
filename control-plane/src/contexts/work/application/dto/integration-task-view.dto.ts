import type { NoticeFileDto } from '@work/application/dto/notice-file.dto';

interface WaitingDto {
  readonly conversationId: string;
  readonly body: string;
  readonly awaitsApproval: boolean;
  readonly attachments: readonly NoticeFileDto[];
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
