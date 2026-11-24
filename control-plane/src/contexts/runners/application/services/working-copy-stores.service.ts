import type { WorkingCopyStoreContract } from '@runners/application/contracts/working-copy-store.contract';
import { workingCopyStoreContract } from '@runners/application/mappers/working-copy-store.mapper';
import type { WorkingCopyStoresPort } from '@runners/application/ports/working-copy-stores.port';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { SandboxRepository } from '@runners/domain/repositories/sandbox.repository';
import type { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';

export class WorkingCopyStores implements WorkingCopyStoresPort {
  constructor(
    private readonly runners: RunnerRepository,
    private readonly sandboxes: SandboxRepository,
    private readonly pools: RunnerPoolRepository,
    private readonly trusts: RunnerTrustRepository,
  ) {}

  async ofRunner(runnerId: RunnerId): Promise<WorkingCopyStoreContract | null> {
    const runner = await this.runners.find(runnerId);

    return runner ? this.of(runner.source) : null;
  }

  async ofSandbox(
    sandboxId: SandboxId,
  ): Promise<WorkingCopyStoreContract | null> {
    const sandbox = await this.sandboxes.find(sandboxId);

    return sandbox ? this.of(sandbox.source) : null;
  }

  private async of(
    source: CredentialSource | null,
  ): Promise<WorkingCopyStoreContract | null> {
    const pool = source?.poolId ? await this.pools.find(source.poolId) : null;
    const trust = source?.trustId
      ? await this.trusts.find(source.trustId)
      : null;
    const holder = pool ?? trust;

    return holder && !holder.isDeleted
      ? workingCopyStoreContract(holder.workingCopies)
      : null;
  }
}
