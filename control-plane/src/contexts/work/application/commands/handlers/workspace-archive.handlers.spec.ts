import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import { GrantWorkspaceArchiveHandler } from '@work/application/commands/handlers/grant-workspace-archive.handler';
import { SealWorkspaceArchiveHandler } from '@work/application/commands/handlers/seal-workspace-archive.handler';
import {
  GrantWorkspaceArchiveCommand,
  SealWorkspaceArchiveCommand,
} from '@work/application/commands/workspace-archive.commands';
import { HeldWorkspaceArchiveHandler } from '@work/application/queries/handlers/held-workspace-archive.handler';
import { HeldWorkspaceArchiveQuery } from '@work/application/queries/held-workspace-archive.query';
import {
  CONTINUING,
  holding,
  InMemoryArchiveStore,
  InMemoryArchives,
} from '@work/application/services/workspace-archives.fake-spec';
import {
  GRANTED_AT,
  SHA256,
  storedAs,
} from '@work/domain/aggregates/workspace-archive.fake-spec';
import { describe, expect, it } from 'vitest';

const setUp = (
  runs: Parameters<typeof holding>[0] = {
    run_1: { runner: 'runner_1', continuity: CONTINUING },
    run_2: { runner: 'runner_2', continuity: CONTINUING },
  },
) => {
  const held = holding(runs);
  const archives = new InMemoryArchives();
  const store = new InMemoryArchiveStore();
  let issued = 0;
  const ids = { generate: () => `archive_${++issued}` };
  const clock = { now: () => GRANTED_AT, sleep: async () => {} };

  return {
    archives,
    store,
    grant: new GrantWorkspaceArchiveHandler(held, archives, store, ids, clock),
    seal: new SealWorkspaceArchiveHandler(held, archives, store, clock),
    read: new HeldWorkspaceArchiveHandler(held, archives, store),
  };
};

describe('keeping a workspace between runs', () => {
  it('grants the runner holding a run one place to upload its archive', async () => {
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

  it('grants nothing to a runner that does not hold the run', async () => {
    const { grant } = setUp();

    await expect(
      grant.execute(
        new GrantWorkspaceArchiveCommand('run_1', 'runner_2', 1_024, SHA256),
      ),
    ).resolves.toBeNull();
  });

  it('refuses work that does not carry on, and archives too large to keep', async () => {
    const { grant } = setUp({
      run_1: {
        runner: 'runner_1',
        continuity: { ...CONTINUING, continuity: null, holder: null },
      },
      run_2: { runner: 'runner_2', continuity: CONTINUING },
    });

    await expect(
      grant.execute(
        new GrantWorkspaceArchiveCommand('run_1', 'runner_1', 1_024, SHA256),
      ),
    ).rejects.toThrow(UseCaseFault);
    await expect(
      grant.execute(
        new GrantWorkspaceArchiveCommand(
          'run_2',
          'runner_2',
          3 * 1024 ** 3,
          SHA256,
        ),
      ),
    ).rejects.toThrow(UseCaseFault);
  });

  it('seals an archive once storage holds it as granted, and the next run restores it', async () => {
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
      read.execute(new HeldWorkspaceArchiveQuery('run_2', 'runner_2')),
    ).resolves.toEqual({
      held: true,
      archive: {
        id: 'archive_1',
        url: 'https://storage.test/get/archive_1',
        size: 1_024,
        sha256: SHA256,
      },
    });
  });

  it('refuses to seal what was never uploaded as granted', async () => {
    const { grant, seal, store } = setUp();

    await grant.execute(
      new GrantWorkspaceArchiveCommand('run_1', 'runner_1', 1_024, SHA256),
    );

    await expect(
      seal.execute(
        new SealWorkspaceArchiveCommand('run_1', 'runner_1', 'archive_1'),
      ),
    ).rejects.toThrow(UseCaseFault);

    store.uploaded.set('archive_1', storedAs(512));

    await expect(
      seal.execute(
        new SealWorkspaceArchiveCommand('run_1', 'runner_1', 'archive_1'),
      ),
    ).rejects.toThrow(UseCaseFault);
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

  it('restores nothing for a run that starts its conversation afresh, or one it does not hold', async () => {
    const { read } = setUp({
      run_1: {
        runner: 'runner_1',
        continuity: { ...CONTINUING, continuing: false },
      },
    });

    await expect(
      read.execute(new HeldWorkspaceArchiveQuery('run_1', 'runner_1')),
    ).resolves.toEqual({ held: true, archive: null });
    await expect(
      read.execute(new HeldWorkspaceArchiveQuery('run_1', 'runner_2')),
    ).resolves.toEqual({ held: false });
  });
});
