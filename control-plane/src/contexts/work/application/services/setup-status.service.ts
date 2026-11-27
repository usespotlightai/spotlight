import type { InstallationPermissionsPort } from '@github/application/ports/installation-permissions.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { RunnerReadinessPort } from '@runners/application/ports/runner-readiness.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { AppGrantsMapper } from '@work/application/mappers/app-grants.mapper';
import type {
  ChatReaderPort,
  SetupChatView,
} from '@work/application/ports/chat-reader.port';
import type { SetupRunners } from '@work/application/rendering/setup-steps';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { SetupState } from '@work/domain/services/setup-list';
import { configuredBy, setupChatOf } from '@work/domain/services/setup-list';
import { AppGrants } from '@work/domain/value-objects/app-grants.vo';

export interface TeamSetup {
  readonly state: SetupState;
  readonly runners: SetupRunners;
  readonly hasEgressCapableRunner: boolean;
  readonly grants: AppGrants;
  readonly chat: SetupChatView | null;
}

export class SetupStatus {
  constructor(
    private readonly connections: WorkspaceConnectionsPort,
    private readonly permissions: InstallationPermissionsPort,
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
    const grants = connectedToGitHub
      ? AppGrantsMapper.toDomain(await this.permissions.of(workspaceId))
      : AppGrants.unread();

    return {
      state: {
        connectedToGitHub,
        hasHarness,
        configured: configuredBy(chat),
      },
      runners: { platform },
      hasEgressCapableRunner,
      grants,
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
