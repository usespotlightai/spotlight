import type { ArchiveGrantDto } from '@runs/application/dto/working-copy-archive.dto';
import type { WorkingCopyArchiveStorePort } from '@runs/application/ports/working-copy-archive-store.port';
import type { ArchiveHolders } from '@runs/application/services/archive-holders.service';
import { WorkingCopyArchive } from '@runs/domain/aggregates/working-copy-archive.aggregate';
import { InvalidWorkingCopyArchiveError } from '@runs/domain/exceptions/invalid-working-copy-archive.error';
import type { WorkingCopyArchiveRepository } from '@runs/domain/repositories/working-copy-archive.repository';
import { ArchiveDigest } from '@runs/domain/value-objects/archive-digest.vo';
import type { ArchiveGrantee } from '@runs/domain/value-objects/archive-grantee.vo';
import {
  type ArchiveLocation,
  StoreSnapshot,
  SpotlightStorage,
} from '@runs/domain/value-objects/archive-location.vo';
import { ArchiveSize } from '@runs/domain/value-objects/archive-size.vo';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import type { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// A tar the runner uploads to Spotlight's storage (size and sha256), or a snapshot the host makes in the store of its working copy hook.
export interface ArchiveGrantStorage {
  readonly size?: number;
  readonly sha256?: string;
  readonly snapshot?: {
    readonly store: string;
    readonly base?: string | null;
  };
}

export type ArchiveGrantRequest = {
  readonly workspaceId: WorkspaceId;
  readonly workingCopyKey: WorkingCopyKey | null;
  readonly grantee: ArchiveGrantee;
} & ArchiveGrantStorage;

const locationOf = (request: ArchiveGrantStorage): ArchiveLocation => {
  const { snapshot, size, sha256 } = request;

  if (snapshot) {
    if (size !== undefined || sha256 !== undefined) {
      throw new InvalidWorkingCopyArchiveError(
        'kept as a snapshot has no size or SHA-256: the host makes the snapshot, and nothing is uploaded',
      );
    }

    return StoreSnapshot.of(snapshot.store, snapshot.base ?? null);
  }

  return SpotlightStorage.of(
    ArchiveSize.of(size ?? Number.NaN),
    ArchiveDigest.of(sha256 ?? ''),
  );
};

export class ArchiveGrants {
  constructor(
    private readonly archives: WorkingCopyArchiveRepository,
    private readonly store: WorkingCopyArchiveStorePort,
    private readonly holders: ArchiveHolders,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async grant(request: ArchiveGrantRequest): Promise<ArchiveGrantDto> {
    const key = request.workingCopyKey;
    const archive = WorkingCopyArchive.grant({
      id: WorkingCopyArchiveId.of(this.ids.generate()),
      workspaceId: request.workspaceId,
      workingCopyKey: key,
      held: key !== null && this.holders.holds(key.owner),
      grantee: request.grantee,
      location: locationOf(request),
      at: this.clock.now(),
    });

    const { snapshot } = archive;

    if (snapshot) {
      await this.archives.add(archive);

      return { id: archive.id.value, snapshot: { name: snapshot } };
    }

    const upload = await this.store.grantUpload(archive);

    await this.archives.add(archive);

    return { id: archive.id.value, url: upload.url, headers: upload.headers };
  }

  async complete(archive: WorkingCopyArchive): Promise<void> {
    if (archive.isCompleted) {
      return;
    }

    const stored =
      archive.location.kind === 'spotlight'
        ? await this.store.stored(archive)
        : null;

    await this.archives.save(archive.complete(stored, this.clock.now()));
  }
}
