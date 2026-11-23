import {
  type StoredArchive,
  WorkingCopyArchive,
} from '@runs/domain/aggregates/working-copy-archive.aggregate';
import { ArchiveDigest } from '@runs/domain/value-objects/archive-digest.vo';
import { ArchiveGrantee } from '@runs/domain/value-objects/archive-grantee.vo';
import {
  StoreSnapshot,
  SpotlightStorage,
} from '@runs/domain/value-objects/archive-location.vo';
import { ArchiveSize } from '@runs/domain/value-objects/archive-size.vo';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const GRANTED_AT = new Date('2026-09-25T10:00:00.000Z');

export const SHA256 = 'a'.repeat(64);

export const later = (ms: number): Date => new Date(GRANTED_AT.getTime() + ms);

export const storedAs = (bytes: number, sha256 = SHA256): StoredArchive => ({
  size: ArchiveSize.of(bytes),
  digest: ArchiveDigest.of(sha256),
});

export const anArchive = (
  overrides: { id?: string; run?: string; bytes?: number } = {},
): WorkingCopyArchive =>
  WorkingCopyArchive.grant({
    id: WorkingCopyArchiveId.of(overrides.id ?? 'archive_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    workingCopyKey: WorkingCopyKey.of('requester', 'subject-task_1'),
    held: true,
    grantee: ArchiveGrantee.run(RunId.of(overrides.run ?? 'run_1')),
    location: SpotlightStorage.of(
      ArchiveSize.of(overrides.bytes ?? 1_024),
      ArchiveDigest.of(SHA256),
    ),
    at: GRANTED_AT,
  });

export const aCompletedArchive = (
  overrides: { id?: string; run?: string } = {},
): WorkingCopyArchive =>
  anArchive(overrides).complete(storedAs(1_024), later(0));

export const aCompletedSnapshotArchive = (
  overrides: { id?: string; run?: string; store?: string } = {},
): WorkingCopyArchive =>
  WorkingCopyArchive.grant({
    id: WorkingCopyArchiveId.of(overrides.id ?? 'archive_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    workingCopyKey: WorkingCopyKey.of('requester', 'subject-task_1'),
    held: true,
    grantee: ArchiveGrantee.run(RunId.of(overrides.run ?? 'run_1')),
    location: StoreSnapshot.of(overrides.store ?? 's3://team-a'),
    at: GRANTED_AT,
  }).complete(null, later(0));

export const aCompletedChatArchive = (): WorkingCopyArchive =>
  WorkingCopyArchive.grant({
    id: WorkingCopyArchiveId.of('archive_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    workingCopyKey: WorkingCopyKey.of('requester', 'conversation-chat_1'),
    held: true,
    grantee: ArchiveGrantee.run(RunId.of('run_1')),
    location: SpotlightStorage.of(
      ArchiveSize.of(1_024),
      ArchiveDigest.of(SHA256),
    ),
    at: GRANTED_AT,
  }).complete(storedAs(1_024), later(0));
