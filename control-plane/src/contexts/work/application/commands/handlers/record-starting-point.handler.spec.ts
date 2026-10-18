import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RecordStartingPointHandler } from '@work/application/commands/handlers/record-starting-point.handler';
import {
  RecordStartingPointCommand,
  type ReportedCheckout,
} from '@work/application/commands/runner.commands';
import {
  aLeasedRun,
  InMemoryArchives,
} from '@work/application/services/workspace-archives.fake-spec';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { WorkspaceArchive } from '@work/domain/aggregates/workspace-archive.aggregate';
import {
  aCompletedArchive,
  anArchive,
  GRANTED_AT,
  SHA256,
  storedAs,
} from '@work/domain/aggregates/workspace-archive.fake-spec';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { describe, expect, it } from 'vitest';

const COMMIT = '4f7c2a9e1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a';

const AT_API: readonly ReportedCheckout[] = [{ path: 'api', commit: COMMIT }];

const setUp = async (
  run: Run = aLeasedRun({ checkouts: ['api'] }),
  known = true,
) => {
  const stored = new Map<string, Run>([[run.id.value, run]]);
  const runs = {
    findById: async (id: { value: string }) => stored.get(id.value) ?? null,
    save: async (saved: Run) => {
      stored.set(saved.id.value, saved);
    },
  } as unknown as RunRepository;
  const archives = new InMemoryArchives();

  await archives.add(aCompletedArchive());
  await archives.add(anArchive({ id: 'archive_incomplete' }));

  return {
    stored,
    archives,
    record: new RecordStartingPointHandler(
      runs,
      archives,
      {
        heartbeat: async () =>
          known
            ? {
                workspaceId: WorkspaceId.of('ws_1'),
                harnesses: [],
                offer: RunnerOffer.none(),
                claims: 'nothing' as const,
              }
            : null,
      },
      { now: () => GRANTED_AT, sleep: async () => {} },
    ),
  };
};

const reported = (
  archiveId: string | null,
  checkouts: readonly ReportedCheckout[] | null = AT_API,
  runner = 'runner_1',
  attempt = 1,
) =>
  new RecordStartingPointCommand(
    'run_1',
    runner,
    attempt,
    archiveId,
    checkouts,
  );

describe('RecordStartingPointHandler', () => {
  it('rejects a runner it does not know', async () => {
    const { record } = await setUp(undefined, false);

    await expect(record.execute(reported(null))).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('rejects a report from an attempt the run is no longer on', async () => {
    const { record } = await setUp();

    await expect(
      record.execute(reported(null, AT_API, 'runner_1', 2)),
    ).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('rejects a body that names no list of checkouts, too many, or no attempt', async () => {
    const { record } = await setUp();
    const many = Array.from({ length: 101 }, (_, at) => ({
      path: `repo_${at}`,
      commit: COMMIT,
    }));

    for (const invalid of [
      reported(null, null),
      reported(null, many),
      reported(null, AT_API, 'runner_1', Number.NaN),
    ]) {
      await expect(record.execute(invalid)).rejects.toMatchObject({
        kind: 'invalid',
      });
    }
  });

  it('records the completed archive the run restored and where each checkout began', async () => {
    const { stored, record } = await setUp();

    await record.execute(reported('archive_1'));

    const started = stored.get('run_1')?.startedFrom;
    expect(started?.archive?.value).toBe('archive_1');
    expect(started?.parts.checkouts).toEqual(AT_API);
    expect(started?.at).toEqual(GRANTED_AT);
  });

  it('records a run that restored nothing as starting afresh', async () => {
    const { stored, record } = await setUp();

    await record.execute(reported(null));

    expect(stored.get('run_1')?.startedFrom?.archive).toBeNull();
  });

  it('rejects an archive the run could not have restored', async () => {
    const { archives, record } = await setUp();
    await archives.add(
      WorkspaceArchive.grant({
        id: WorkspaceArchiveId.of('archive_of_another_task'),
        workspaceId: WorkspaceId.of('ws_1'),
        resumeKey: ResumeKey.forTask('task_2'),
        holder: { kind: 'task', taskId: TaskId.of('task_2') },
        run: RunId.of('run_2'),
        size: ArchiveSize.of(1_024),
        digest: ArchiveDigest.of(SHA256),
        at: GRANTED_AT,
      }).complete(storedAs(1_024), GRANTED_AT),
    );

    for (const archive of [
      'archive_incomplete',
      'archive_missing',
      'archive_of_another_task',
    ]) {
      await expect(record.execute(reported(archive))).rejects.toMatchObject({
        kind: 'invalid',
      });
    }
  });

  it('rejects a commit that is not a full SHA', async () => {
    const { record } = await setUp();

    await expect(
      record.execute(reported(null, [{ path: 'api', commit: 'abc123' }])),
    ).rejects.toBeInstanceOf(ApplicationError);
  });

  it('rejects checkouts other than the ones of the run', async () => {
    const { record } = await setUp();

    await expect(
      record.execute(reported(null, [{ path: 'web', commit: COMMIT }])),
    ).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('rejects a runner that does not lease the run, before looking at the archive', async () => {
    const { record } = await setUp();

    await expect(
      record.execute(reported('archive_missing', AT_API, 'runner_2')),
    ).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('rejects a run that works no task', async () => {
    const { record } = await setUp(
      aLeasedRun({ restoresWorkspace: false, checkouts: ['api'] }),
    );

    await expect(record.execute(reported(null))).rejects.toMatchObject({
      kind: 'conflict',
    });
  });

  it('says there is no such run', async () => {
    const { record } = await setUp();

    await expect(
      record.execute(
        new RecordStartingPointCommand('run_9', 'runner_1', 1, null, AT_API),
      ),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });
});
