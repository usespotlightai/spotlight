import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';

export class ArchiveGrantee {
  private constructor(
    readonly runId: RunId | null,
    readonly sandboxId: SandboxId | null,
  ) {}

  static run(runId: RunId): ArchiveGrantee {
    return new ArchiveGrantee(runId, null);
  }

  static sandbox(sandboxId: SandboxId): ArchiveGrantee {
    return new ArchiveGrantee(null, sandboxId);
  }

  isRun(runId: RunId): boolean {
    return this.runId?.equals(runId) ?? false;
  }

  isSandbox(sandboxId: SandboxId): boolean {
    return this.sandboxId?.equals(sandboxId) ?? false;
  }
}
