import type { LeasedRun } from '@runs/application/ports/run-leases.port';
import type { RunsPort } from '@runs/application/ports/runs.port';
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
import { NotAllowedForIsolatedRunError } from '@work/domain/exceptions/not-allowed-for-isolated-run.error';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import {
  type TrialRepository,
  trialRepositoryNamed,
} from '@work/domain/value-objects/dispatch-subject.vo';

const NO_TOOLS =
  'This run uses no tools: it acts on nothing beyond its own result.';

export class TrialRunWork implements RunWork {
  constructor(
    private readonly run: LeasedRun,
    private readonly briefed: BriefedTask | null,
    private readonly repositories: readonly TrialRepository[],
    private readonly asking: RunsPort,
  ) {}

  get workspaceId(): WorkspaceId {
    return this.run.workspaceId;
  }

  async acknowledgeUpTo(): Promise<void> {
    throw new NotAllowedForIsolatedRunError(
      'acknowledge the messages of a person',
    );
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
      throw new NotAllowedForIsolatedRunError(`push to ${name}`);
    }

    return trialRepositoryNamed(this.repositories, name);
  }

  async toolContext(): Promise<ToolContext> {
    throw new NotAllowedForIsolatedRunError('use a tool');
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
