import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ToolContext } from '@work/application/ports/integration-tools.port';
import type { LeasedRun } from '@work/application/ports/run-leases.port';
import type { RunsPort } from '@work/application/ports/runs.port';
import type {
  Cleared,
  ConnectionAsked,
  PermissionCleared,
  RunWork,
} from '@work/application/services/run-work';
import { NotAllowedInSearchError } from '@work/domain/exceptions/not-allowed-in-search.error';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';

const NO_TOOLS =
  'A search uses no tools: it proposes candidates and leaves nothing else behind.';

export class SearchRunWork implements RunWork {
  constructor(
    private readonly run: LeasedRun,
    private readonly runs: RunsPort,
  ) {}

  get workspaceId(): WorkspaceId {
    return this.run.workspaceId;
  }

  async acknowledgeUpTo(): Promise<void> {
    throw new NotAllowedInSearchError('acknowledge the messages of a person');
  }

  attachment(): Attachment | null {
    return null;
  }

  async repositoryNamed(name: string): Promise<Repository | null> {
    throw new NotAllowedInSearchError(`use the repository ${name}`);
  }

  async toolContext(): Promise<ToolContext> {
    throw new NotAllowedInSearchError('use a tool');
  }

  async clearFor(): Promise<Cleared> {
    return { kind: 'dismissed', reason: NO_TOOLS };
  }

  async askToConnect(): Promise<ConnectionAsked> {
    return { kind: 'denied', reason: NO_TOOLS };
  }

  async clearPermission(): Promise<PermissionCleared> {
    await this.runs.askedAPerson({
      runId: this.run.runId,
      runner: this.run.claimedBy,
    });

    return 'pending';
  }
}
