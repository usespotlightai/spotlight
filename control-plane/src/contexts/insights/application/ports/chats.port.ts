import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import type { Money } from '@insights/domain/value-objects/run-usage.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
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

export interface ChatRunSpend {
  readonly runId: RunId;
  readonly chatId: string;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly harness: string;
  readonly model: string | null;
  readonly repositories: readonly string[];
  readonly spend: Money | null;
  readonly spentAt: Date;
}

export interface ChatsPort {
  note(chat: StartedChat): Promise<void>;

  /** Keeps what one run of a chat cost, once. */
  spent(run: ChatRunSpend): Promise<void>;

  removeIn(scope: DeletionScope): Promise<void>;
}
