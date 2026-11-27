import type { RepositorySettingsPort } from '@github/application/ports/repository-settings.port';
import type { LeasedRunFacts } from '@runs/application/ports/run-leases.port';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { GitService } from '@work/application/dto/git-call.dto';
import type { ConnectionMissingDto } from '@work/application/ports/integration-tool-calls.port';
import type { ChatToolContext } from '@work/application/ports/integration-tools.port';
import { ChatRefused } from '@work/application/rendering/chat-refused';
import type {
  Cleared,
  ConnectionAsked,
  PermissionCleared,
  RunWork,
} from '@work/application/services/run-work';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { ChatPush } from '@work/domain/services/chat-push';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import type { RefUpdate } from '@work/domain/value-objects/ref-update.vo';

export class ChatRunWork implements RunWork {
  constructor(
    private readonly run: LeasedRunFacts,
    private readonly chat: Chat,
    private readonly chats: ChatRepository,
    private readonly tasks: TaskRepository,
    private readonly settings: RepositorySettingsPort,
  ) {}

  get workspaceId(): WorkspaceId {
    return this.chat.workspaceId;
  }

  async acknowledgeUpTo(position: number, at: Date): Promise<void> {
    await this.chats.save(
      this.chat.acknowledgeUpTo(
        this.run.runId,
        MessagePosition.of(position),
        at,
      ),
    );
  }

  attachment(attachmentId: string): Attachment | null {
    return (
      this.chat.sharedAttachments.find(
        (each) => each.id.value === attachmentId,
      ) ?? null
    );
  }

  async repositoryNamed(
    name: string,
    service: GitService,
  ): Promise<Repository | null> {
    return service === 'git-receive-pack'
      ? this.chat.pushableNamed(name)
      : this.chat.repositoryNamed(name);
  }

  readonly limitsPushes = true;

  async pushRefusal(
    repository: Repository,
    updates: readonly RefUpdate[],
  ): Promise<string | null> {
    if (updates.length === 0) {
      return null;
    }

    const named = await this.settings
      .defaultBranchNameOf(this.chat.workspaceId, repository)
      .catch(() => null);

    if (!nonEmpty(named)) {
      return `Spotlight could not read the default branch of ${repository.value} from GitHub, so it cannot check this push. Push again in a minute.`;
    }

    const defaultBranch = Branch.of(named);

    for (const update of updates) {
      const branch = update.branch;
      const refusal = ChatPush.refusal({
        chat: this.chat.id,
        update,
        defaultBranch,
        owner: branch
          ? await this.tasks.onBranch(this.chat.workspaceId, branch)
          : null,
      });

      if (refusal) {
        return ChatRefused.text(refusal);
      }
    }

    return null;
  }

  async pushed(): Promise<void> {}

  async clearFor(declared: DeclaredTool): Promise<Cleared> {
    const refusal = this.chat.toolRefusal(declared);

    return refusal
      ? { kind: 'dismissed', reason: ChatRefused.text(refusal) }
      : { kind: 'approved', edited: null, returned: async () => {} };
  }

  async askToConnect(
    _declared: DeclaredTool,
    missing: ConnectionMissingDto,
  ): Promise<ConnectionAsked> {
    return {
      kind: 'denied',
      reason: ChatRefused.text(
        this.chat.connectionAskRefusal(missing.integrationName),
      ),
    };
  }

  async clearPermission(): Promise<PermissionCleared> {
    return 'dismissed';
  }

  async toolContext(): Promise<ChatToolContext> {
    return {
      kind: 'chat',
      runId: this.run.runId,
      workspaceId: this.chat.workspaceId,
      chatId: this.chat.id,
      teamId: this.chat.teamId,
      requester: this.chat.startedBy,
    };
  }
}
