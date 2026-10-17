import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ToolContext } from '@work/application/ports/integration-tools.port';
import type {
  Cleared,
  ConnectionAsked,
  PermissionCleared,
  RunWork,
} from '@work/application/services/run-work';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { KeptFromSearchesError } from '@work/domain/exceptions/kept-from-searches.error';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';

const NO_TOOLS =
  'A search uses no tools: it proposes candidates and leaves nothing else behind.';

export class SearchRunWork implements RunWork {
  constructor(
    private readonly run: Run,
    private readonly runs: RunRepository,
  ) {}

  get workspaceId(): WorkspaceId {
    return this.run.workspaceId;
  }

  async deliverUpTo(): Promise<void> {
    throw new KeptFromSearchesError('take up what a person says');
  }

  gave(): Attachment | null {
    return null;
  }

  async repositoryNamed(name: string): Promise<Repository | null> {
    throw new KeptFromSearchesError(`reach the repository ${name}`);
  }

  async toolContext(): Promise<ToolContext> {
    throw new KeptFromSearchesError('use a tool');
  }

  async clearFor(): Promise<Cleared> {
    return { kind: 'refused', reason: NO_TOOLS };
  }

  async askToConnect(): Promise<ConnectionAsked> {
    return { kind: 'denied', reason: NO_TOOLS };
  }

  async clearPermission(): Promise<PermissionCleared> {
    const current = await this.runs.findById(this.run.id);
    const by = current?.claimedBy;

    if (!current || !by) {
      throw new UnknownRunError(`Run ${this.run.id.value} is not leased.`);
    }

    await this.runs.save(current.askedAPersonBy(by));

    return 'asked';
  }
}
