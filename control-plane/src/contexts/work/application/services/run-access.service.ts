import type {
  RunViewerSource,
  ViewedRun,
} from '@runs/application/ports/run-viewers.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  RunsInWorkspace,
  RunsOfChat,
} from '@work/application/ports/viewed-runs';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { WorkRequesters } from '@work/application/services/work-requesters';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';

export class RunAccess implements RunViewerSource {
  readonly owner = WorkRequesters.owner;

  constructor(
    private readonly chats: ChatRepository,
    private readonly access: WorkAccess,
  ) {}

  async readableAmong(
    runs: readonly ViewedRun[],
    viewer: UserId,
  ): Promise<ReadonlySet<string>> {
    const workspaces = new Map<string, Promise<boolean>>();
    const seesWorkspace = (workspaceId: WorkspaceId) => {
      const known = workspaces.get(workspaceId.value);

      if (known) {
        return known;
      }

      const sees = this.seesTaskRunsIn(workspaceId, viewer);
      workspaces.set(workspaceId.value, sees);
      return sees;
    };
    const readable = await Promise.all(
      runs.map(async (run) => {
        const chatId = WorkRequesters.chatOf(run.requester);

        if (chatId) {
          const chat = await this.chats.find(chatId);

          return chat !== null && this.access.opensChat(chat, viewer);
        }

        return seesWorkspace(run.workspaceId);
      }),
    );

    return new Set(
      runs.flatMap((run, index) => (readable[index] ? [run.runId.value] : [])),
    );
  }

  seesTaskRunsIn(workspaceId: WorkspaceId, viewer: UserId): Promise<boolean> {
    return this.access.seesWorkspace(workspaceId, viewer);
  }

  seesTeamRuns(teamId: TeamId, viewer: UserId): Promise<boolean> {
    return this.access.seesWorkspaceOfTeam(teamId, viewer);
  }

  async shownInWorkspace<T>(
    runs: RunsInWorkspace<T> | null,
    viewer: UserId,
  ): Promise<T | null> {
    return runs && (await this.seesTaskRunsIn(runs.workspaceId, viewer))
      ? runs.found
      : null;
  }

  async shownOfChat<T>(
    runs: RunsOfChat<T> | null,
    viewer: UserId,
  ): Promise<T | null> {
    return runs && (await this.access.opensChat(runs, viewer))
      ? runs.found
      : null;
  }
}
