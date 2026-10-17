import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { GrantWorkspaceArchiveHandler } from '@work/application/commands/handlers/grant-workspace-archive.handler';
import { SealWorkspaceArchiveHandler } from '@work/application/commands/handlers/seal-workspace-archive.handler';
import {
  GrantWorkspaceArchiveCommand,
  SealWorkspaceArchiveCommand,
} from '@work/application/commands/workspace-archive.commands';
import { StoredWorkspaceArchiveHandler } from '@work/application/queries/handlers/stored-workspace-archive.handler';
import { StoredWorkspaceArchiveQuery } from '@work/application/queries/stored-workspace-archive.query';
import {
  aLeasedRun,
  InMemoryArchiveStore,
  InMemoryArchives,
  runsOf,
} from '@work/application/services/workspace-archives.fake-spec';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import {
  GRANTED_AT,
  SHA256,
  storedAs,
} from '@work/domain/aggregates/workspace-archive.fake-spec';
import { InvalidWorkspaceArchiveError } from '@work/domain/exceptions/invalid-workspace-archive.error';
import { describe, expect, it } from 'vitest';

const setUp = (...runs: Run[]) => {
  const runRepository = runsOf(
    ...(runs.length > 0
      ? runs
      : [aLeasedRun(), aLeasedRun({ id: 'run_2', runner: 'runner_2' })]),
  );
  const archives = new InMemoryArchives();
  const store = new InMemoryArchiveStore();
  let issued = 0;
  const ids = { generate: () => `archive_${++issued}` };
  const clock = { now: () => GRANTED_AT, sleep: async () => {} };

  return {
    archives,
    store,
    grant: new GrantWorkspaceArchiveHandler(
      runRepository,
      archives,
      store,
      ids,
      clock,
    ),
    seal: new SealWorkspaceArchiveHandler(
      runRepository,
      archives,
      store,
      clock,
    ),
    read: new StoredWorkspaceArchiveHandler(runRepository, archives, store),
  };
};

describe('keeping a workspace between runs', () => {
  it('grants the runner that leases a run one place to upload its archive', async () => {
    const { grant, archives } = setUp();

    const granted = await grant.execute(
      new GrantWorkspaceArchiveCommand('run_1', 'runner_1', 1_024, SHA256),
    );

    expect(granted).toEqual({
      id: 'archive_1',
      url: 'https://storage.test/put/archive_1',
      headers: { 'x-amz-checksum-sha256': SHA256 },
    });
    expect(archives.kept.get('archive_1')?.isSealed).toBe(false);
  });

  it('grants nothing to a runner that does not lease the run', async () => {
    const { grant } = setUp();

    await expect(
      grant.execute(
        new GrantWorkspaceArchiveCommand('run_1', 'runner_2', 1_024, SHA256),
      ),
    ).resolves.toBeNull();
  });

  it('rejects work that does not carry on, and archives too large to keep', async () => {
    const { grant, archives } = setUp(
      aLeasedRun({ carriesOn: false }),
      aLeasedRun({ id: 'run_2', runner: 'runner_2' }),
    );

    await expect(
      grant.execute(
        new GrantWorkspaceArchiveCommand('run_1', 'runner_1', 1_024, SHA256),
      ),
    ).rejects.toThrow(ApplicationError);
    await expect(
      grant.execute(
        new GrantWorkspaceArchiveCommand(
          'run_2',
          'runner_2',
          3 * 1024 ** 3,
          SHA256,
        ),
      ),
    ).rejects.toThrow(ApplicationError);
    expect(archives.kept.size).toBe(0);
  });

  it('keeps no archive the store cannot take', async () => {
    const { grant, archives, store } = setUp();
    store.grantUpload = async () => {
      throw new InvalidWorkspaceArchiveError('cannot be kept here');
    };

    await expect(
      grant.execute(
        new GrantWorkspaceArchiveCommand('run_1', 'runner_1', 1_024, SHA256),
      ),
    ).rejects.toThrow(ApplicationError);
    expect(archives.kept.size).toBe(0);
  });

  it('seals an archive once storage has it as granted, and the next run restores it', async () => {
    const { grant, seal, read, store } = setUp();

    await grant.execute(
      new GrantWorkspaceArchiveCommand('run_1', 'runner_1', 1_024, SHA256),
    );
    store.uploaded.set('archive_1', storedAs(1_024));

    await expect(
      seal.execute(
        new SealWorkspaceArchiveCommand('run_1', 'runner_1', 'archive_1'),
      ),
    ).resolves.toBe(true);

    await expect(
      read.execute(new StoredWorkspaceArchiveQuery('run_2', 'runner_2')),
    ).resolves.toEqual({
      leased: true,
      archive: {
        id: 'archive_1',
        url: 'https://storage.test/get/archive_1',
        size: 1_024,
        sha256: SHA256,
      },
    });
  });

  it('does not seal what was never uploaded as granted', async () => {
    const { grant, seal, store } = setUp();

    await grant.execute(
      new GrantWorkspaceArchiveCommand('run_1', 'runner_1', 1_024, SHA256),
    );

    await expect(
      seal.execute(
        new SealWorkspaceArchiveCommand('run_1', 'runner_1', 'archive_1'),
      ),
    ).rejects.toThrow(ApplicationError);

    store.uploaded.set('archive_1', storedAs(512));

    await expect(
      seal.execute(
        new SealWorkspaceArchiveCommand('run_1', 'runner_1', 'archive_1'),
      ),
    ).rejects.toThrow(ApplicationError);
  });

  it('seals only an archive granted to the run sealing it', async () => {
    const { grant, seal, store } = setUp();

    await grant.execute(
      new GrantWorkspaceArchiveCommand('run_1', 'runner_1', 1_024, SHA256),
    );
    store.uploaded.set('archive_1', storedAs(1_024));

    await expect(
      seal.execute(
        new SealWorkspaceArchiveCommand('run_2', 'runner_2', 'archive_1'),
      ),
    ).resolves.toBe(false);
    await expect(
      seal.execute(
        new SealWorkspaceArchiveCommand('run_1', 'runner_1', 'archive_9'),
      ),
    ).resolves.toBe(false);
  });

  it('restores a task’s workspace for a run that starts its conversation afresh', async () => {
    const { grant, seal, read, store } = setUp(
      aLeasedRun(),
      aLeasedRun({ id: 'run_2', runner: 'runner_2', session: null }),
    );

    await grant.execute(
      new GrantWorkspaceArchiveCommand('run_1', 'runner_1', 1_024, SHA256),
    );
    store.uploaded.set('archive_1', storedAs(1_024));
    await seal.execute(
      new SealWorkspaceArchiveCommand('run_1', 'runner_1', 'archive_1'),
    );

    await expect(
      read.execute(new StoredWorkspaceArchiveQuery('run_2', 'runner_2')),
    ).resolves.toMatchObject({ leased: true, archive: { id: 'archive_1' } });
  });

  it('restores nothing before a task has an archive, or for a run it does not lease', async () => {
    const { read } = setUp(aLeasedRun({ session: null }));

    await expect(
      read.execute(new StoredWorkspaceArchiveQuery('run_1', 'runner_1')),
    ).resolves.toEqual({ leased: true, archive: null });
    await expect(
      read.execute(new StoredWorkspaceArchiveQuery('run_1', 'runner_2')),
    ).resolves.toEqual({ leased: false });
  });
});
