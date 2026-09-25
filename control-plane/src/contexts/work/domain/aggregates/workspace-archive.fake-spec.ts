import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  type StoredArchive,
  WorkspaceArchive,
} from '@work/domain/aggregates/workspace-archive.aggregate';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

export const GRANTED_AT = new Date('2026-09-25T10:00:00.000Z');

export const SHA256 = 'a'.repeat(64);

export const later = (ms: number): Date => new Date(GRANTED_AT.getTime() + ms);

export const storedAs = (bytes: number, sha256 = SHA256): StoredArchive => ({
  size: ArchiveSize.of(bytes),
  digest: ArchiveDigest.of(sha256),
});

export const anArchive = (
  overrides: { id?: string; run?: string; bytes?: number } = {},
): WorkspaceArchive =>
  WorkspaceArchive.granted({
    id: WorkspaceArchiveId.of(overrides.id ?? 'archive_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    continuity: ContinuityKey.for({ taskId: 'task_1', stationId: 'station_1' }),
    holder: {
      kind: 'task',
      taskId: TaskId.of('task_1'),
      stationId: StationId.of('station_1'),
    },
    run: RunId.of(overrides.run ?? 'run_1'),
    size: ArchiveSize.of(overrides.bytes ?? 1_024),
    digest: ArchiveDigest.of(SHA256),
    at: GRANTED_AT,
  });

export const aSealedArchive = (
  overrides: { id?: string; run?: string } = {},
): WorkspaceArchive => anArchive(overrides).sealed(storedAs(1_024), later(0));
