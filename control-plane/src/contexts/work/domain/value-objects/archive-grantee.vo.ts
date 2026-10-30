import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class ArchiveGrantee {
  private constructor(
    readonly runId: RunId | null,
    readonly sandboxId: string | null,
  ) {}

  static run(runId: RunId): ArchiveGrantee {
    return new ArchiveGrantee(runId, null);
  }

  static sandbox(sandboxId: string): ArchiveGrantee {
    if (sandboxId.trim().length === 0) {
      throw new InconsistentStateError('archive grantee', 'names no sandbox');
    }

    return new ArchiveGrantee(null, sandboxId);
  }

  isRun(runId: RunId): boolean {
    return this.runId?.equals(runId) ?? false;
  }

  isSandbox(sandboxId: string): boolean {
    return this.sandboxId === sandboxId;
  }
}
