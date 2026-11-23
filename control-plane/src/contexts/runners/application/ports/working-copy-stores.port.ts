import type { WorkingCopyStoreContract } from '@runners/application/contracts/working-copy-store.contract';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';

export const WORKING_COPY_STORES = Symbol('WORKING_COPY_STORES');

// The store that the pool or trust of a runner or a sandbox keeps working copies in, as Spotlight knows it, never as
// the runner says. Null when Spotlight keeps them as archives, or when the runner or sandbox is not known.
export interface WorkingCopyStoresPort {
  ofRunner(runnerId: RunnerId): Promise<WorkingCopyStoreContract | null>;

  ofSandbox(sandboxId: SandboxId): Promise<WorkingCopyStoreContract | null>;
}
