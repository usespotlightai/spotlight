import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { GitService } from '@work/application/ports/git-gateway.port';
import type { ToolContext } from '@work/application/ports/integration-tools.port';
import type { LeasedRun } from '@work/application/ports/run-leases.port';
import type { RunsPort } from '@work/application/ports/runs.port';
import type {
  Cleared,
  ConnectionAsked,
  PermissionCleared,
  RunWork,
} from '@work/application/services/run-work';
import { NotAllowedInReplayError } from '@work/domain/exceptions/not-allowed-in-replay.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';

const NO_TOOLS =
  'A replay uses no tools: it leaves nothing behind but its own result.';

export class ReplayRunWork implements RunWork {
  constructor(
    private readonly run: LeasedRun,
    private readonly briefed: BriefedTask | null,
    private readonly runs: RunRepository,
    private readonly asking: RunsPort,
  ) {}

  get workspaceId(): WorkspaceId {
    return this.run.workspaceId;
  }

  async acknowledgeUpTo(): Promise<void> {
    throw new NotAllowedInReplayError('acknowledge the messages of a person');
  }

  attachment(attachmentId: string): Attachment | null {
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
      throw new NotAllowedInReplayError(`push to ${name}`);
    }

    const run = await this.runs.findById(this.run.runId);

    return run?.replayedRepository(name) ?? null;
  }

  async toolContext(): Promise<ToolContext> {
    throw new NotAllowedInReplayError('use a tool');
  }

  async clearFor(): Promise<Cleared> {
    return { kind: 'dismissed', reason: NO_TOOLS };
  }

  async askToConnect(): Promise<ConnectionAsked> {
    return { kind: 'denied', reason: NO_TOOLS };
  }

  async clearPermission(): Promise<PermissionCleared> {
    await this.asking.askedAPerson({
      runId: this.run.runId,
      runner: this.run.claimedBy,
    });

    return 'pending';
  }
}
