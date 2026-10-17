import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ChatRecord {
  private constructor(
    readonly chatId: string,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly startedBy: UserId,
    readonly startedAt: Date,
    readonly version: number,
  ) {}

  static start(input: {
    chatId: string;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    startedBy: UserId;
    startedAt: Date;
  }): ChatRecord {
    return new ChatRecord(
      input.chatId,
      input.workspaceId,
      input.teamId,
      input.startedBy,
      input.startedAt,
      0,
    );
  }

  static rehydrate(input: {
    chatId: string;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    startedBy: UserId;
    startedAt: Date;
    version: number;
  }): ChatRecord {
    return new ChatRecord(
      input.chatId,
      input.workspaceId,
      input.teamId,
      input.startedBy,
      input.startedAt,
      input.version,
    );
  }
}
