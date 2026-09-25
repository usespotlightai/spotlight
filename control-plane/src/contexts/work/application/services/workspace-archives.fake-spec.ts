import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  HeldContinuity,
  HeldRunReaderPort,
} from '@work/application/ports/held-run-reader.port';
import type {
  ArchiveUpload,
  WorkspaceArchiveStorePort,
} from '@work/application/ports/workspace-archive-store.port';
import type {
  StoredArchive,
  WorkspaceArchive,
} from '@work/domain/aggregates/workspace-archive.aggregate';
import { WorkspaceArchiveMovedOnError } from '@work/domain/exceptions/workspace-archive-moved-on.error';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';
import type { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { ContinuityKey as Key } from '@work/domain/value-objects/continuity-key.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import type { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

export const CONTINUING: HeldContinuity = {
  workspaceId: WorkspaceId.of('ws_1'),
  continuity: Key.for({ taskId: 'task_1', stationId: 'station_1' }),
  holder: {
    kind: 'task',
    taskId: TaskId.of('task_1'),
    stationId: StationId.of('station_1'),
  },
  continuing: true,
};

export const holding = (
  runs: Record<string, { runner: string; continuity: HeldContinuity }>,
): HeldRunReaderPort => ({
  pendingFor: async () => null,
  stopRequestedFor: async () => false,
  attachmentFor: async () => null,
  continuityOf: async (runId, runnerId) => {
    const held = runs[runId.value];

    return held?.runner === runnerId.value ? held.continuity : null;
  },
});

export class InMemoryArchives implements WorkspaceArchiveRepository {
  readonly kept = new Map<string, WorkspaceArchive>();

  async add(archive: WorkspaceArchive): Promise<void> {
    this.kept.set(archive.id.value, archive);
  }

  async save(archive: WorkspaceArchive): Promise<void> {
    const held = this.kept.get(archive.id.value);

    if (!held || held.version !== archive.version) {
      throw new WorkspaceArchiveMovedOnError(archive.id.value);
    }

    if (archive.isDiscarded) {
      this.kept.delete(archive.id.value);
      return;
    }

    this.kept.set(archive.id.value, archive);
  }

  async find(id: WorkspaceArchiveId): Promise<WorkspaceArchive | null> {
    return this.kept.get(id.value) ?? null;
  }

  async newestSealed(
    workspaceId: WorkspaceId,
    continuity: ContinuityKey,
  ): Promise<WorkspaceArchive | null> {
    const sealed = [...this.kept.values()]
      .filter(
        (each) =>
          each.isSealed &&
          each.workspaceId.equals(workspaceId) &&
          each.continuity.equals(continuity),
      )
      .sort(
        (a, b) => (b.sealedAt?.getTime() ?? 0) - (a.sealedAt?.getTime() ?? 0),
      );

    return sealed[0] ?? null;
  }
}

export class InMemoryArchiveStore implements WorkspaceArchiveStorePort {
  readonly uploaded = new Map<string, StoredArchive>();
  readonly removed: string[] = [];

  async grantUpload(archive: WorkspaceArchive): Promise<ArchiveUpload> {
    return {
      url: `https://storage.test/put/${archive.id.value}`,
      headers: { 'x-amz-checksum-sha256': archive.digest.sha256 },
    };
  }

  async stored(archive: WorkspaceArchive): Promise<StoredArchive | null> {
    return this.uploaded.get(archive.id.value) ?? null;
  }

  async grantDownload(archive: WorkspaceArchive): Promise<string> {
    return `https://storage.test/get/${archive.id.value}`;
  }

  async remove(archive: WorkspaceArchive): Promise<void> {
    this.removed.push(archive.id.value);
    this.uploaded.delete(archive.id.value);
  }
}
