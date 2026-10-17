import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RecordStartingPointHandler } from '@work/application/commands/handlers/record-starting-point.handler';
import {
  RecordStartingPointCommand,
  type ReportedCheckout,
} from '@work/application/commands/runner.commands';
import {
  aHeldRun,
  InMemoryArchives,
} from '@work/application/services/workspace-archives.fake-spec';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { WorkspaceArchive } from '@work/domain/aggregates/workspace-archive.aggregate';
import {
  anArchive,
  aSealedArchive,
  GRANTED_AT,
  SHA256,
  storedAs,
} from '@work/domain/aggregates/workspace-archive.fake-spec';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { describe, expect, it } from 'vitest';

const COMMIT = '4f7c2a9e1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a';

const AT_API: readonly ReportedCheckout[] = [{ path: 'api', commit: COMMIT }];

const setUp = async (
  run: Run = aHeldRun({ checkouts: ['api'] }),
  known = true,
) => {
  const held = new Map<string, Run>([[run.id.value, run]]);
  const runs = {
    findById: async (id: { value: string }) => held.get(id.value) ?? null,
    save: async (saved: Run) => {
      held.set(saved.id.value, saved);
    },
  } as unknown as RunRepository;
  const archives = new InMemoryArchives();

  await archives.add(aSealedArchive());
  await archives.add(anArchive({ id: 'archive_unsealed' }));

  return {
    held,
    archives,
    record: new RecordStartingPointHandler(
      runs,
      archives,
      {
        seen: async () =>
          known
            ? {
                workspaceId: WorkspaceId.of('ws_1'),
                harnesses: [],
                terms: RunnerTerms.none(),
                claims: 'nothing' as const,
              }
            : null,
      },
      { now: () => GRANTED_AT, sleep: async () => {} },
    ),
  };
};

const told = (
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
  it('refuses a runner it does not know', async () => {
    const { record } = await setUp(undefined, false);

    await expect(record.execute(told(null))).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('refuses a report from an attempt the run is no longer on', async () => {
    const { record } = await setUp();

    await expect(
      record.execute(told(null, AT_API, 'runner_1', 2)),
    ).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('refuses a body that names no list of checkouts, too many, or no attempt', async () => {
    const { record } = await setUp();
    const many = Array.from({ length: 101 }, (_, at) => ({
      path: `repo_${at}`,
      commit: COMMIT,
    }));

    for (const refused of [
      told(null, null),
      told(null, many),
      told(null, AT_API, 'runner_1', Number.NaN),
    ]) {
      await expect(record.execute(refused)).rejects.toMatchObject({
        kind: 'invalid',
      });
    }
  });

  it('records the sealed archive the run restored and where each checkout began', async () => {
    const { held, record } = await setUp();

    await record.execute(told('archive_1'));

    const started = held.get('run_1')?.startedFrom;
    expect(started?.archive?.value).toBe('archive_1');
    expect(started?.parts.checkouts).toEqual(AT_API);
    expect(started?.at).toEqual(GRANTED_AT);
  });

  it('records a run that restored nothing as starting afresh', async () => {
    const { held, record } = await setUp();

    await record.execute(told(null));

    expect(held.get('run_1')?.startedFrom?.archive).toBeNull();
  });

  it('refuses an archive the run could not have restored', async () => {
    const { archives, record } = await setUp();
    await archives.add(
      WorkspaceArchive.grant({
        id: WorkspaceArchiveId.of('archive_of_another_task'),
        workspaceId: WorkspaceId.of('ws_1'),
        continuity: ContinuityKey.forTask('task_2'),
        holder: { kind: 'task', taskId: TaskId.of('task_2') },
        run: RunId.of('run_2'),
        size: ArchiveSize.of(1_024),
        digest: ArchiveDigest.of(SHA256),
        at: GRANTED_AT,
      }).seal(storedAs(1_024), GRANTED_AT),
    );

    for (const archive of [
      'archive_unsealed',
      'archive_missing',
      'archive_of_another_task',
    ]) {
      await expect(record.execute(told(archive))).rejects.toMatchObject({
        kind: 'invalid',
      });
    }
  });

  it('refuses a commit that is not a full SHA', async () => {
    const { record } = await setUp();

    await expect(
      record.execute(told(null, [{ path: 'api', commit: 'abc123' }])),
    ).rejects.toBeInstanceOf(ApplicationError);
  });

  it('refuses checkouts other than the ones the run was given', async () => {
    const { record } = await setUp();

    await expect(
      record.execute(told(null, [{ path: 'web', commit: COMMIT }])),
    ).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('refuses a runner that does not hold the run, before looking at the archive', async () => {
    const { record } = await setUp();

    await expect(
      record.execute(told('archive_missing', AT_API, 'runner_2')),
    ).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('refuses a run that works no task', async () => {
    const { record } = await setUp(
      aHeldRun({ carriesOn: false, checkouts: ['api'] }),
    );

    await expect(record.execute(told(null))).rejects.toMatchObject({
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
