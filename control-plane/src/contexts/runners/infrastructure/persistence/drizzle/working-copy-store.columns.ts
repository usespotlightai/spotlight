import { WorkingCopyStore } from '@runners/domain/value-objects/working-copy-store.vo';

interface WorkingCopyColumns {
  readonly workingCopyStore: string | null;
  readonly workingCopyBase: string | null;
}

export const workingCopyStoreColumns = (
  store: WorkingCopyStore | null,
): WorkingCopyColumns => ({
  workingCopyStore: store?.store.value ?? null,
  workingCopyBase: store?.base?.value ?? null,
});

export const workingCopyStoreOf = (
  row: WorkingCopyColumns,
): WorkingCopyStore | null =>
  row.workingCopyStore === null
    ? null
    : WorkingCopyStore.of({
        store: row.workingCopyStore,
        base: row.workingCopyBase,
      });
