import type { StoredArchiveDto } from '@runs/application/dto/working-copy-archive.dto';
import type { WorkingCopyArchiveStorePort } from '@runs/application/ports/working-copy-archive-store.port';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type { WorkingCopyArchive } from '@runs/domain/aggregates/working-copy-archive.aggregate';
import type { WorkingCopyArchiveRepository } from '@runs/domain/repositories/working-copy-archive.repository';
import { StoreSnapshot } from '@runs/domain/value-objects/archive-location.vo';
import type { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// The archive a run or a sandbox restores, and how a runner reaches it.
export class RestoredArchives {
  constructor(
    private readonly archives: WorkingCopyArchiveRepository,
    private readonly store: WorkingCopyArchiveStorePort,
  ) {}

  async of(run: Run): Promise<WorkingCopyArchive | null> {
    const source = run.restoresFrom;

    if (!source) {
      return null;
    }

    const candidate =
      'archive' in source
        ? await this.archives.find(source.archive)
        : await this.archives.newestCompleted(run.workspaceId, source.newestOf);

    return run.archiveToRestore(candidate ? [candidate] : []);
  }

  newestOf(
    workspaceId: WorkspaceId,
    key: WorkingCopyKey | null,
  ): Promise<WorkingCopyArchive | null> {
    return key
      ? this.archives.newestCompleted(workspaceId, key)
      : Promise.resolve(null);
  }

  // A snapshot is restored by a host of its store, so Spotlight grants no download for it. rebase says the run
  // starts from the store's current base instead.
  async answer(
    archive: WorkingCopyArchive,
    rebase: boolean,
  ): Promise<StoredArchiveDto> {
    const { location } = archive;

    if (location.kind === 'snapshot') {
      return {
        id: archive.id.value,
        snapshot: {
          store: location.store.value,
          name: StoreSnapshot.nameOf(archive.id).value,
          base: location.base?.value ?? null,
          rebase,
        },
      };
    }

    return {
      id: archive.id.value,
      url: await this.store.grantDownload(archive),
      size: location.size.bytes,
      sha256: location.digest.sha256,
    };
  }
}
