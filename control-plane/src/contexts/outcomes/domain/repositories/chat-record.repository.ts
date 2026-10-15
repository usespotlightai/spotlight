import type { ChatRecord } from '@outcomes/domain/aggregates/chat-record.aggregate';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ChatRecordRepository {
  add(record: ChatRecord): Promise<void>;

  of(chatId: string): Promise<ChatRecord | null>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
