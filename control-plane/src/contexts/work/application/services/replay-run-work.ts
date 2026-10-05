import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { GitService } from '@work/application/ports/git-gateway.port';
import type { ToolContext } from '@work/application/ports/integration-tools.port';
import type {
  Cleared,
  ConnectionAsked,
  PermissionCleared,
  RunWork,
} from '@work/application/services/run-work';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { KeptFromReplaysError } from '@work/domain/exceptions/kept-from-replays.error';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';

const NO_TOOLS =
  'A replay uses no tools: it leaves nothing behind but its own result.';

export class ReplayRunWork implements RunWork {
  constructor(
    private readonly run: Run,
    private readonly briefed: BriefedTask | null,
    private readonly runs: RunRepository,
  ) {}

  get workspaceId(): WorkspaceId {
    return this.run.workspaceId;
  }

  async deliverUpTo(): Promise<void> {
    throw new KeptFromReplaysError('take up what a person says');
  }

  gave(attachmentId: string): Attachment | null {
    return (
      this.briefed?.allAttachments.find(
        (each) => each.id.value === attachmentId,
      ) ?? null
    );
  }

  async repositoryNamed(
    name: string,
    service: GitService,
  ): Promise<Repository | null> {
    if (service !== 'git-upload-pack') {
      throw new KeptFromReplaysError(`push to ${name}`);
    }

    return this.run.replayedRepository(name);
  }

  async toolContext(): Promise<ToolContext> {
    throw new KeptFromReplaysError('use a tool');
  }

  async clearFor(): Promise<Cleared> {
    return { kind: 'refused', reason: NO_TOOLS };
  }

  async askToConnect(): Promise<ConnectionAsked> {
    return { kind: 'refused', reason: NO_TOOLS };
  }

  async clearPermission(): Promise<PermissionCleared> {
    const current = await this.runs.findById(this.run.id);
    const by = current?.claimedBy;

    if (!current || !by) {
      throw new UnknownRunError(`there is no run ${this.run.id.value} held`);
    }

    await this.runs.save(current.askedAPersonBy(by));

    return 'asked';
  }
}
