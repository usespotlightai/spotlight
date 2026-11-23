import type { StoredArchiveDto } from '@runs/application/dto/working-copy-archive.dto';
import type { WorkingCopyArchiveStorePort } from '@runs/application/ports/working-copy-archive-store.port';
import type { WorkingCopyArchive } from '@runs/domain/aggregates/working-copy-archive.aggregate';
import { StoreSnapshot } from '@runs/domain/value-objects/archive-location.vo';

// A snapshot is restored by a host of its store. Spotlight grants no download for it. rebase says the run starts
// from the store's current base instead of the snapshot.
export const storedArchiveOf = async (
  archive: WorkingCopyArchive,
  store: WorkingCopyArchiveStorePort,
  rebase = false,
): Promise<StoredArchiveDto> => {
  const { location } = archive;

  if (location.kind === 'snapshot') {
    return {
      id: archive.id.value,
      snapshot: {
        store: location.store,
        name: StoreSnapshot.nameOf(archive.id),
        base: location.base,
        rebase,
      },
    };
  }

  return {
    id: archive.id.value,
    url: await store.grantDownload(archive),
    size: location.size.bytes,
    sha256: location.digest.sha256,
  };
};
