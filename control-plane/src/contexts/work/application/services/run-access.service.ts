import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import type {
  RunViewersPort,
  ViewedRun,
  WatchedRun,
} from '@runs/application/ports/run-viewers.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  RunsInWorkspace,
  RunsOfChat,
} from '@work/application/ports/viewed-runs';
import { WorkRequesters } from '@work/application/services/work-requesters';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatAccess } from '@work/domain/services/chat-access';

export class RunAccess implements RunViewersPort {
  constructor(
    private readonly facts: RunFactsPort,
    private readonly chats: ChatRepository,
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
  ) {}

  async watchedBy(runId: RunId, viewer: UserId): Promise<WatchedRun | null> {
    const [run] = await this.facts.of([runId]);

    return run && (await this.readableAmong([run], viewer)).has(runId.value)
      ? run
      : null;
  }

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
        if (!run.policy.listed) {
          return false;
        }

        const chatId = WorkRequesters.chatOf(run.requester);

        if (chatId) {
          const chat = await this.chats.find(chatId);

          return chat !== null && this.seesChatRunsOf(chat.startedBy, viewer);
        }

        return seesWorkspace(run.workspaceId);
      }),
    );

    return new Set(
      runs.flatMap((run, index) => (readable[index] ? [run.runId.value] : [])),
    );
  }

  seesTaskRunsIn(workspaceId: WorkspaceId, viewer: UserId): Promise<boolean> {
    return this.access.mayView(viewer, workspaceId);
  }

  async seesTeamRuns(teamId: TeamId, viewer: UserId): Promise<boolean> {
    const team = await this.teams.find(teamId);

    return team !== null && this.seesTaskRunsIn(team.workspaceId, viewer);
  }

  seesChatRunsOf(startedBy: UserId, viewer: UserId): boolean {
    return ChatAccess.readableBy(startedBy, viewer);
  }

  async shownInWorkspace<T>(
    runs: RunsInWorkspace<T> | null,
    viewer: UserId,
  ): Promise<T | null> {
    return runs && (await this.seesTaskRunsIn(runs.workspaceId, viewer))
      ? runs.found
      : null;
  }

  shownOfChat<T>(runs: RunsOfChat<T> | null, viewer: UserId): T | null {
    return runs && this.seesChatRunsOf(runs.startedBy, viewer)
      ? runs.found
      : null;
  }
}
