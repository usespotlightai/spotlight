import type { ChatRecord } from '@outcomes/domain/aggregates/chat-record.aggregate';
import type { TeamWindow } from '@outcomes/domain/repositories/run-record.repository';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ChatRecordRepository {
  add(record: ChatRecord): Promise<void>;

  of(chatId: string): Promise<ChatRecord | null>;

  ofTeamBetween(
    window: TeamWindow,
    most: number,
  ): Promise<readonly ChatRecord[]>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
