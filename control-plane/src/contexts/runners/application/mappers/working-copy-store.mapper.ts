import type { WorkingCopyStoreContract } from '@runners/application/contracts/working-copy-store.contract';
import type { WorkingCopyStore } from '@runners/domain/value-objects/working-copy-store.vo';

export type WorkingCopyStoreDto = WorkingCopyStoreContract;

export const workingCopiesDto = (
  store: WorkingCopyStore | null,
): WorkingCopyStoreDto | null =>
  store ? { store: store.store, base: store.base } : null;
