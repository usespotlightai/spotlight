import type {
  AuthenticatedSandbox,
  SandboxesPort,
} from '@runners/application/ports/sandboxes.port';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { CompleteSandboxArchiveHandler } from '@work/application/commands/handlers/complete-sandbox-archive.handler';
import { GrantSandboxArchiveHandler } from '@work/application/commands/handlers/grant-sandbox-archive.handler';
import { GrantWorkspaceArchiveHandler } from '@work/application/commands/handlers/grant-workspace-archive.handler';
import {
  CompleteSandboxArchiveCommand,
  GrantSandboxArchiveCommand,
  GrantWorkspaceArchiveCommand,
} from '@work/application/commands/workspace-archive.commands';
import { StoredSandboxArchiveHandler } from '@work/application/queries/handlers/stored-sandbox-archive.handler';
import { StoredSandboxArchiveQuery } from '@work/application/queries/stored-workspace-archive.query';
import { SandboxArchives } from '@work/application/services/sandbox-archives.service';
import {
  aLeasedRun,
  InMemoryArchiveStore,
  InMemoryArchives,
  runsOf,
} from '@work/application/services/workspace-archives.fake-spec';
import {
  GRANTED_AT,
  SHA256,
  storedAs,
} from '@work/domain/aggregates/workspace-archive.fake-spec';
import { describe, expect, it } from 'vitest';

const TOKEN = 'sandbox-token';

const setUp = (
  sandbox: AuthenticatedSandbox = {
    id: 'sandbox_1',
    workspaceId: 'ws_1',
    key: 'task-task_1',
  },
) => {
  const sandboxes = new SandboxArchives({
    authenticate: async (token: string | undefined) =>
      token === TOKEN ? sandbox : null,
  } as unknown as SandboxesPort);
  const archives = new InMemoryArchives();
  const store = new InMemoryArchiveStore();
  let issued = 0;
  const ids = { generate: () => `archive_${++issued}` };
  const clock = { now: () => GRANTED_AT, sleep: async () => {} };

  return {
    archives,
    store,
    grant: new GrantSandboxArchiveHandler(
      sandboxes,
      archives,
      store,
      ids,
      clock,
    ),
    complete: new CompleteSandboxArchiveHandler(
      sandboxes,
      archives,
      store,
      clock,
    ),
    read: new StoredSandboxArchiveHandler(sandboxes, archives, store),
    grantForRun: new GrantWorkspaceArchiveHandler(
      runsOf(aLeasedRun()),
      archives,
      store,
      ids,
      clock,
    ),
  };
};

describe('archiving a sandbox’s workspace with its own token', () => {
  it('grants an archive to the sandbox, for the task its key names', async () => {
    const { grant, archives } = setUp();

    await expect(
      grant.execute(
        new GrantSandboxArchiveCommand('sandbox_1', TOKEN, 1_024, SHA256),
      ),
    ).resolves.toMatchObject({ id: 'archive_1' });

    const granted = archives.stored.get('archive_1');
    expect(granted?.grantedForSandbox('sandbox_1')).toBe(true);
    expect(granted?.resumeKey.value).toBe('task-task_1');
    expect(granted?.holder).toMatchObject({ kind: 'task' });
  });

  it('grants nothing for a wrong token, or for another sandbox', async () => {
    const { grant } = setUp();

    await expect(
      grant.execute(
        new GrantSandboxArchiveCommand('sandbox_1', 'stolen', 1_024, SHA256),
      ),
    ).resolves.toBeNull();
    await expect(
      grant.execute(
        new GrantSandboxArchiveCommand('sandbox_2', TOKEN, 1_024, SHA256),
      ),
    ).resolves.toBeNull();
    await expect(
      grant.execute(
        new GrantSandboxArchiveCommand('sandbox_1', undefined, 1_024, SHA256),
      ),
    ).resolves.toBeNull();
  });

  it('rejects a sandbox of no task or chat', async () => {
    for (const key of [null, 'replay-run_9']) {
      const { grant, archives } = setUp({
        id: 'sandbox_1',
        workspaceId: 'ws_1',
        key,
      });

      await expect(
        grant.execute(
          new GrantSandboxArchiveCommand('sandbox_1', TOKEN, 1_024, SHA256),
        ),
      ).rejects.toThrow(ApplicationError);
      expect(archives.stored.size).toBe(0);
    }
  });

  it('completes the sandbox’s archive, and the next sandbox of the key restores it', async () => {
    const { grant, complete, read, store } = setUp();

    await grant.execute(
      new GrantSandboxArchiveCommand('sandbox_1', TOKEN, 1_024, SHA256),
    );
    store.uploaded.set('archive_1', storedAs(1_024));

    await expect(
      complete.execute(
        new CompleteSandboxArchiveCommand('sandbox_1', TOKEN, 'archive_1'),
      ),
    ).resolves.toBe(true);
    await expect(
      read.execute(new StoredSandboxArchiveQuery('sandbox_1', TOKEN)),
    ).resolves.toEqual({
      known: true,
      archive: {
        id: 'archive_1',
        url: 'https://storage.test/get/archive_1',
        size: 1_024,
        sha256: SHA256,
      },
    });
  });

  it('restores the newest archive of the key, also one a run left', async () => {
    const { grantForRun, read, archives, store } = setUp();

    await grantForRun.execute(
      new GrantWorkspaceArchiveCommand('run_1', 'runner_1', 1_024, SHA256),
    );
    store.uploaded.set('archive_1', storedAs(1_024));
    const granted = archives.stored.get('archive_1');
    if (granted) {
      archives.stored.set(
        'archive_1',
        granted.complete(storedAs(1_024), GRANTED_AT),
      );
    }

    await expect(
      read.execute(new StoredSandboxArchiveQuery('sandbox_1', TOKEN)),
    ).resolves.toMatchObject({ known: true, archive: { id: 'archive_1' } });
  });

  it('completes no archive granted to a run or another sandbox', async () => {
    const { grantForRun, complete } = setUp();

    await grantForRun.execute(
      new GrantWorkspaceArchiveCommand('run_1', 'runner_1', 1_024, SHA256),
    );

    await expect(
      complete.execute(
        new CompleteSandboxArchiveCommand('sandbox_1', TOKEN, 'archive_1'),
      ),
    ).resolves.toBe(false);
  });

  it('tells a sandbox with nothing to restore to start empty, and an unknown one nothing', async () => {
    const { read } = setUp();

    await expect(
      read.execute(new StoredSandboxArchiveQuery('sandbox_1', TOKEN)),
    ).resolves.toEqual({ known: true, archive: null });
    await expect(
      read.execute(new StoredSandboxArchiveQuery('sandbox_1', 'stolen')),
    ).resolves.toEqual({ known: false });
  });
});
