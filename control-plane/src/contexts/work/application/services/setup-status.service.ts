import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { RunnerReadinessPort } from '@runners/application/ports/runner-readiness.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  ChatReaderPort,
  SetupChatView,
} from '@work/application/ports/chat-reader.port';
import type { SetupRunners } from '@work/application/rendering/setup-steps';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { SetupState } from '@work/domain/services/setup-list';
import { configuredBy, setupChatOf } from '@work/domain/services/setup-list';

export interface TeamSetup {
  readonly state: SetupState;
  readonly runners: SetupRunners;
  readonly hasEgressCapableRunner: boolean;
  readonly chat: SetupChatView | null;
}

export class SetupStatus {
  constructor(
    private readonly connections: WorkspaceConnectionsPort,
    private readonly runners: RunnerReadinessPort,
    private readonly chats: ChatReaderPort,
    private readonly chatRepository: ChatRepository,
  ) {}

  async of(workspaceId: WorkspaceId, teamId: TeamId): Promise<TeamSetup> {
    const connectedToGitHub = await this.connections.isConnected(workspaceId);
    const hasHarness = await this.runners.readyToRun(workspaceId);
    const hasEgressCapableRunner =
      await this.runners.hasEgressCapableRunner(workspaceId);
    const platform = await this.runners.hasPlatformRunners(workspaceId);
    const chat = setupChatOf(await this.chats.setupChatsOf(teamId));

    return {
      state: {
        connectedToGitHub,
        hasHarness,
        configured: configuredBy(chat),
      },
      runners: { platform },
      hasEgressCapableRunner,
      chat,
    };
  }

  async stateFor(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<SetupState> {
    const connectedToGitHub = await this.connections.isConnected(workspaceId);
    const hasHarness = await this.runners.readyToRun(workspaceId);
    const chats = await this.chatRepository.ofTeam(teamId);

    return {
      connectedToGitHub,
      hasHarness,
      configured: configuredBy(
        setupChatOf(
          chats.flatMap((each) =>
            each.setup
              ? [
                  {
                    pullRequest: each.setup.pullRequest?.value ?? null,
                    startedAt: each.createdAt,
                  },
                ]
              : [],
          ),
        ),
      ),
    };
  }
}
