import type { WorkingCopyStoreContract } from '@runners/application/contracts/working-copy-store.contract';
import type { KeptStore } from '@runs/domain/value-objects/archive-location.vo';
import {
  SnapshotName,
  WorkingCopyStoreName,
} from '@shared-kernel/domain/value-objects/working-copy-names.vo';

export const keptStoreOf = (
  store: WorkingCopyStoreContract | null,
): KeptStore | null =>
  store
    ? {
        store: WorkingCopyStoreName.of(store.store),
        base: store.base === null ? null : SnapshotName.of(store.base),
      }
    : null;
