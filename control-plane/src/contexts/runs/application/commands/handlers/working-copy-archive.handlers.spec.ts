import type { WorkingCopyStoreContract } from '@runners/application/contracts/working-copy-store.contract';
import type { WorkingCopyStoresPort } from '@runners/application/ports/working-copy-stores.port';
import { CompleteWorkingCopyArchiveHandler } from '@runs/application/commands/handlers/complete-working-copy-archive.handler';
import { GrantWorkingCopyArchiveHandler } from '@runs/application/commands/handlers/grant-working-copy-archive.handler';
import {
  CompleteWorkingCopyArchiveCommand,
  GrantWorkingCopyArchiveCommand,
} from '@runs/application/commands/working-copy-archive.commands';
import { StoredWorkingCopyArchiveHandler } from '@runs/application/queries/handlers/stored-working-copy-archive.handler';
import { StoredWorkingCopyArchiveQuery } from '@runs/application/queries/stored-working-copy-archive.query';
import { ArchiveGrants } from '@runs/application/services/archive-grants.service';
import { RestoredArchives } from '@runs/application/services/restored-archives.service';
import {
  aLeasedRun,
  holding,
  InMemoryArchiveStore,
  InMemoryArchives,
  runsOf,
} from '@runs/application/services/working-copy-archives.fake-spec';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import {
  GRANTED_AT,
  SHA256,
  storedAs,
} from '@runs/domain/aggregates/working-copy-archive.fake-spec';
import { InvalidWorkingCopyArchiveError } from '@runs/domain/exceptions/invalid-working-copy-archive.error';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { describe, expect, it } from 'vitest';

const setUp = (...runs: Run[]) => setUpWith({ runs, keptStore: null });

const setUpWith = (input: {
  runs: Run[];
  keptStore: WorkingCopyStoreContract | null;
}) => {
  const { runs, keptStore } = input;
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
  const grants = new ArchiveGrants(
    archives,
    store,
    holding('requester'),
    ids,
    clock,
  );
  const restored = new RestoredArchives(archives, store);
  const stores: WorkingCopyStoresPort = {
    ofRunner: async () => keptStore,
    ofSandbox: async () => keptStore,
  };

  return {
    archives,
    store,
    grant: new GrantWorkingCopyArchiveHandler(
      runRepository,
      grants,
      restored,
      stores,
    ),
    complete: new CompleteWorkingCopyArchiveHandler(
      runRepository,
      archives,
      grants,
    ),
    read: new StoredWorkingCopyArchiveHandler(runRepository, restored, stores),
  };
};

describe('archiving a working copy between runs', () => {
  it('grants the runner that leases a run one place to upload its archive', async () => {
    const { grant, archives } = setUp();

    const granted = await grant.execute(
      new GrantWorkingCopyArchiveCommand('run_1', 'runner_1', {
        kind: 'tar',
        size: 1_024,
        sha256: SHA256,
      }),
    );

    expect(granted).toEqual({
      id: 'archive_1',
      url: 'https://storage.test/put/archive_1',
      headers: { 'x-amz-checksum-sha256': SHA256 },
    });
    expect(archives.stored.get('archive_1')?.isCompleted).toBe(false);
  });

  it('grants nothing to a runner that does not lease the run', async () => {
    const { grant } = setUp();

    await expect(
      grant.execute(
        new GrantWorkingCopyArchiveCommand('run_1', 'runner_2', {
          kind: 'tar',
          size: 1_024,
          sha256: SHA256,
        }),
      ),
    ).resolves.toBeNull();
  });

  it('rejects work that does not carry on, and archives too large to store', async () => {
    const { grant, archives } = setUp(
      aLeasedRun({ restoresWorkingCopy: false }),
      aLeasedRun({ id: 'run_2', runner: 'runner_2' }),
    );

    await expect(
      grant.execute(
        new GrantWorkingCopyArchiveCommand('run_1', 'runner_1', {
          kind: 'tar',
          size: 1_024,
          sha256: SHA256,
        }),
      ),
    ).rejects.toThrow(ApplicationError);
    await expect(
      grant.execute(
        new GrantWorkingCopyArchiveCommand('run_2', 'runner_2', {
          kind: 'tar',
          size: 3 * 1024 ** 3,
          sha256: SHA256,
        }),
      ),
    ).rejects.toThrow(ApplicationError);
    expect(archives.stored.size).toBe(0);
  });

  it('keeps no archive the store cannot take', async () => {
    const { grant, archives, store } = setUp();
    store.grantUpload = async () => {
      throw new InvalidWorkingCopyArchiveError('cannot be stored here');
    };

    await expect(
      grant.execute(
        new GrantWorkingCopyArchiveCommand('run_1', 'runner_1', {
          kind: 'tar',
          size: 1_024,
          sha256: SHA256,
        }),
      ),
    ).rejects.toThrow(ApplicationError);
    expect(archives.stored.size).toBe(0);
  });

  it('completes an archive once storage has it as granted, and the next run restores it', async () => {
    const { grant, complete, read, store } = setUp();

    await grant.execute(
      new GrantWorkingCopyArchiveCommand('run_1', 'runner_1', {
        kind: 'tar',
        size: 1_024,
        sha256: SHA256,
      }),
    );
    store.uploaded.set('archive_1', storedAs(1_024));

    await expect(
      complete.execute(
        new CompleteWorkingCopyArchiveCommand('run_1', 'runner_1', 'archive_1'),
      ),
    ).resolves.toBe(true);

    await expect(
      read.execute(new StoredWorkingCopyArchiveQuery('run_2', 'runner_2')),
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

  it('does not complete what was never uploaded as granted', async () => {
    const { grant, complete, store } = setUp();

    await grant.execute(
      new GrantWorkingCopyArchiveCommand('run_1', 'runner_1', {
        kind: 'tar',
        size: 1_024,
        sha256: SHA256,
      }),
    );

    await expect(
      complete.execute(
        new CompleteWorkingCopyArchiveCommand('run_1', 'runner_1', 'archive_1'),
      ),
    ).rejects.toThrow(ApplicationError);

    store.uploaded.set('archive_1', storedAs(512));

    await expect(
      complete.execute(
        new CompleteWorkingCopyArchiveCommand('run_1', 'runner_1', 'archive_1'),
      ),
    ).rejects.toThrow(ApplicationError);
  });

  it('completes only an archive granted to the run sealing it', async () => {
    const { grant, complete, store } = setUp();

    await grant.execute(
      new GrantWorkingCopyArchiveCommand('run_1', 'runner_1', {
        kind: 'tar',
        size: 1_024,
        sha256: SHA256,
      }),
    );
    store.uploaded.set('archive_1', storedAs(1_024));

    await expect(
      complete.execute(
        new CompleteWorkingCopyArchiveCommand('run_2', 'runner_2', 'archive_1'),
      ),
    ).resolves.toBe(false);
    await expect(
      complete.execute(
        new CompleteWorkingCopyArchiveCommand('run_1', 'runner_1', 'archive_9'),
      ),
    ).resolves.toBe(false);
  });

  it('restores a task’s working copy for a run that starts its conversation afresh', async () => {
    const { grant, complete, read, store } = setUp(
      aLeasedRun(),
      aLeasedRun({ id: 'run_2', runner: 'runner_2', session: null }),
    );

    await grant.execute(
      new GrantWorkingCopyArchiveCommand('run_1', 'runner_1', {
        kind: 'tar',
        size: 1_024,
        sha256: SHA256,
      }),
    );
    store.uploaded.set('archive_1', storedAs(1_024));
    await complete.execute(
      new CompleteWorkingCopyArchiveCommand('run_1', 'runner_1', 'archive_1'),
    );

    await expect(
      read.execute(new StoredWorkingCopyArchiveQuery('run_2', 'runner_2')),
    ).resolves.toMatchObject({ leased: true, archive: { id: 'archive_1' } });
  });

  it('restores nothing before a task has an archive, or for a run it does not lease', async () => {
    const { read } = setUp(aLeasedRun({ session: null }));

    await expect(
      read.execute(new StoredWorkingCopyArchiveQuery('run_1', 'runner_1')),
    ).resolves.toEqual({ leased: true, archive: null });
    await expect(
      read.execute(new StoredWorkingCopyArchiveQuery('run_1', 'runner_2')),
    ).resolves.toEqual({ leased: false });
  });
});

describe('archiving a working copy in the store of the hosts', () => {
  const STORE = { store: 's3://team-a', base: 'base-v1' };

  it('grants a snapshot in the store of the runner’s pool, as Spotlight knows it', async () => {
    const { grant, complete, read, archives } = setUpWith({
      runs: [aLeasedRun(), aLeasedRun({ id: 'run_2', runner: 'runner_2' })],
      keptStore: STORE,
    });

    const granted = await grant.execute(
      new GrantWorkingCopyArchiveCommand('run_1', 'runner_1', {
        kind: 'snapshot',
        base: 'base-v1',
      }),
    );
    await complete.execute(
      new CompleteWorkingCopyArchiveCommand('run_1', 'runner_1', 'archive_1'),
    );

    expect(granted).toEqual({
      id: 'archive_1',
      snapshot: { name: 'spotlight-archive_1' },
    });
    const kept = archives.stored.get('archive_1')?.location;
    expect(kept?.kind === 'snapshot' && kept.store.value).toBe('s3://team-a');
    expect(
      await read.execute(
        new StoredWorkingCopyArchiveQuery('run_2', 'runner_2'),
      ),
    ).toMatchObject({
      archive: {
        id: 'archive_1',
        snapshot: { store: 's3://team-a', base: 'base-v1', rebase: false },
      },
    });
  });

  it('refuses a tar from a runner whose pool keeps working copies in a store', async () => {
    const { grant, archives } = setUpWith({
      runs: [aLeasedRun()],
      keptStore: STORE,
    });

    await expect(
      grant.execute(
        new GrantWorkingCopyArchiveCommand('run_1', 'runner_1', {
          kind: 'tar',
          size: 1_024,
          sha256: SHA256,
        }),
      ),
    ).rejects.toMatchObject({ kind: 'invalid' });
    expect(archives.stored.size).toBe(0);
  });

  it('refuses a snapshot from a runner whose pool keeps no store', async () => {
    const { grant } = setUp();

    await expect(
      grant.execute(
        new GrantWorkingCopyArchiveCommand('run_1', 'runner_1', {
          kind: 'snapshot',
          base: null,
        }),
      ),
    ).rejects.toBeInstanceOf(ApplicationError);
  });

  it('refuses a snapshot that names a base its working copy cannot descend from', async () => {
    const { grant } = setUpWith({ runs: [aLeasedRun()], keptStore: STORE });

    await expect(
      grant.execute(
        new GrantWorkingCopyArchiveCommand('run_1', 'runner_1', {
          kind: 'snapshot',
          base: 'base-of-another-team',
        }),
      ),
    ).rejects.toMatchObject({ kind: 'invalid' });
  });
});
