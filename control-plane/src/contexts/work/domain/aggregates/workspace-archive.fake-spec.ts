import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  type StoredArchive,
  WorkspaceArchive,
} from '@work/domain/aggregates/workspace-archive.aggregate';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
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
  WorkspaceArchive.grant({
    id: WorkspaceArchiveId.of(overrides.id ?? 'archive_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    resumeKey: ResumeKey.forTask('task_1'),
    holder: { kind: 'task', taskId: TaskId.of('task_1') },
    run: RunId.of(overrides.run ?? 'run_1'),
    size: ArchiveSize.of(overrides.bytes ?? 1_024),
    digest: ArchiveDigest.of(SHA256),
    at: GRANTED_AT,
  });

export const aCompletedArchive = (
  overrides: { id?: string; run?: string } = {},
): WorkspaceArchive => anArchive(overrides).complete(storedAs(1_024), later(0));

export const aCompletedChatArchive = (): WorkspaceArchive =>
  WorkspaceArchive.grant({
    id: WorkspaceArchiveId.of('archive_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    resumeKey: ResumeKey.forChat('chat_1'),
    holder: { kind: 'chat', chatId: ChatId.of('chat_1') },
    run: RunId.of('run_1'),
    size: ArchiveSize.of(1_024),
    digest: ArchiveDigest.of(SHA256),
    at: GRANTED_AT,
  }).complete(storedAs(1_024), later(0));
