import type { WorkingCopyStoreContract } from '@runners/application/contracts/working-copy-store.contract';
import type { WorkingCopyStore } from '@runners/domain/value-objects/working-copy-store.vo';

export const workingCopyStoreContract = (
  store: WorkingCopyStore | null,
): WorkingCopyStoreContract | null =>
  store ? { store: store.store.value, base: store.base?.value ?? null } : null;
