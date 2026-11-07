import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface StartedChat {
  readonly chatId: string;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly startedBy: UserId;
  readonly startedAt: Date;
}

export interface ChatsPort {
  note(chat: StartedChat): Promise<void>;

  removeIn(scope: DeletionScope): Promise<void>;
}
