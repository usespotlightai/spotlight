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
import { WorkspaceArchiveMovedOnError } from '@work/domain/exceptions/workspace-archive-moved-on.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';
import type { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { ContinuityKey as Key } from '@work/domain/value-objects/continuity-key.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import type { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

const HELD_AT = new Date('2026-09-25T09:00:00.000Z');

export const aHeldRun = (
  over: {
    id?: string;
    runner?: string;
    session?: string | null;
    carriesOn?: boolean;
  } = {},
): Run =>
  Run.enqueue({
    id: RunId.of(over.id ?? 'run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    subject:
      over.carriesOn === false
        ? null
        : RunSubject.task(
            TaskId.of('task_1'),
            StationId.of('station_1'),
            TaskRevision.of(1),
          ),
    spec: RunSpec.of({
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'keep the workspace',
      handover: { options: [], noteLimit: 4_000 },
      continuity: {
        key: Key.for({ taskId: 'task_1', stationId: 'station_1' }).value,
        ...(over.session === null
          ? {}
          : { sessionId: over.session ?? 'session_1' }),
      },
    }),
  }).claim(RunnerId.of(over.runner ?? 'runner_1'), HELD_AT);

export const holding = (...held: readonly Run[]): RunRepository =>
  ({
    findById: async (id: RunId) =>
      held.find((each) => each.id.equals(id)) ?? null,
  }) as unknown as RunRepository;

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
