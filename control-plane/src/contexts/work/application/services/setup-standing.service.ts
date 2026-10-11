import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  ChatReaderPort,
  SetupChatView,
} from '@work/application/ports/chat-reader.port';
import type { SetupState } from '@work/domain/services/setup-list';

export interface TeamSetup {
  readonly state: SetupState;
  readonly chat: SetupChatView | null;
}

export class SetupStanding {
  constructor(
    private readonly connections: WorkspaceConnectionsPort,
    private readonly runners: RunnerReaderPort,
    private readonly chats: ChatReaderPort,
  ) {}

  async of(workspaceId: WorkspaceId, teamId: TeamId): Promise<TeamSetup> {
    const [connectedToGitHub, hasHarness, chat] = await Promise.all([
      this.connections.isConnected(workspaceId),
      this.runners.readyToRun(workspaceId),
      this.chats.setupOf(teamId),
    ]);

    return {
      state: {
        connectedToGitHub,
        hasHarness,
        configured: chat?.pullRequest != null,
      },
      chat,
    };
  }
}
