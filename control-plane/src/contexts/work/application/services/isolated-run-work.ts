import type { LeasedRunFacts } from '@runs/application/ports/run-leases.port';
import type { RunsPort } from '@runs/application/ports/runs.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ToolContext } from '@work/application/ports/integration-tools.port';
import type {
  Cleared,
  ConnectionAsked,
  PermissionCleared,
  RunWork,
} from '@work/application/services/run-work';
import { NotAllowedForIsolatedRunError } from '@work/domain/exceptions/not-allowed-for-isolated-run.error';
import { ToolNotEnabledError } from '@work/domain/exceptions/tool-not-enabled.error';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';

const NO_TOOLS =
  'This run uses no tools: it acts on nothing beyond its own result.';

export class IsolatedRunWork implements RunWork {
  constructor(
    private readonly run: LeasedRunFacts,
    private readonly runs: RunsPort,
  ) {}

  get workspaceId(): WorkspaceId {
    return this.run.workspaceId;
  }

  async acknowledgeUpTo(): Promise<void> {
    throw new NotAllowedForIsolatedRunError(
      'acknowledge the messages of a person',
    );
  }

  attachment(): Attachment | null {
    return null;
  }

  async repositoryNamed(name: string): Promise<Repository | null> {
    throw new NotAllowedForIsolatedRunError(`use the repository ${name}`);
  }

  async toolContext(tool: Tool): Promise<ToolContext> {
    throw new ToolNotEnabledError(tool.value);
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
