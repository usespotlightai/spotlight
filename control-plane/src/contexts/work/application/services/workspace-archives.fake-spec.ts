import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  ArchiveUpload,
  WorkspaceArchiveStorePort,
} from '@work/application/ports/workspace-archive-store.port';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type {
  StoredArchive,
  WorkspaceArchive,
} from '@work/domain/aggregates/workspace-archive.aggregate';
import { WorkspaceArchiveVersionConflictError } from '@work/domain/exceptions/workspace-archive-version-conflict.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';
import type { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
import { ResumeKey as Key } from '@work/domain/value-objects/resume-key.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import type { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

const CLAIMED_AT = new Date('2026-09-25T09:00:00.000Z');

export const aLeasedRun = (
  over: {
    id?: string;
    runner?: string;
    session?: string | null;
    restoresWorkspace?: boolean;
    checkouts?: readonly string[];
  } = {},
): Run =>
  Run.enqueue({
    id: RunId.of(over.id ?? 'run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    subject:
      over.restoresWorkspace === false
        ? null
        : RunSubject.task(
            TaskId.of('task_1'),
            StationId.of('station_1'),
            TaskRevision.of(1),
          ),
    spec: RunSpec.of({
      ...(over.checkouts
        ? {
            checkouts: over.checkouts.map((path) => ({
              remote: 'spotlight:repository',
              path,
            })),
          }
        : {}),
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'keep the workspace',
      handover: { options: [], noteLimit: 4_000 },
      resume: {
        key: Key.forTask('task_1').value,
        ...(over.session === null
          ? {}
          : { sessionId: over.session ?? 'session_1' }),
      },
    }),
  }).claim(RunnerId.of(over.runner ?? 'runner_1'), CLAIMED_AT);

export const runsOf = (...runs: readonly Run[]): RunRepository =>
  ({
    findById: async (id: RunId) =>
      runs.find((each) => each.id.equals(id)) ?? null,
  }) as unknown as RunRepository;

export class InMemoryArchives implements WorkspaceArchiveRepository {
  readonly stored = new Map<string, WorkspaceArchive>();

  async add(archive: WorkspaceArchive): Promise<void> {
    this.stored.set(archive.id.value, archive);
  }

  async save(archive: WorkspaceArchive): Promise<void> {
    const existing = this.stored.get(archive.id.value);

    if (!existing || existing.version !== archive.version) {
      throw new WorkspaceArchiveVersionConflictError(archive.id.value);
    }

    if (archive.isDiscarded) {
      this.stored.delete(archive.id.value);
      return;
    }

    this.stored.set(archive.id.value, archive);
  }

  async find(id: WorkspaceArchiveId): Promise<WorkspaceArchive | null> {
    return this.stored.get(id.value) ?? null;
  }

  async newestCompleted(
    workspaceId: WorkspaceId,
    resumeKey: ResumeKey,
  ): Promise<WorkspaceArchive | null> {
    const completed = [...this.stored.values()]
      .filter(
        (each) =>
          each.isCompleted &&
          each.workspaceId.equals(workspaceId) &&
          each.resumeKey.equals(resumeKey),
      )
      .sort(
        (a, b) =>
          (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
      );

    return completed[0] ?? null;
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
