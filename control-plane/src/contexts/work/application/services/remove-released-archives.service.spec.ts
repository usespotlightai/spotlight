import type { ArchiveReferencesPort } from '@work/application/ports/archive-references.port';
import { RemoveReleasedArchives } from '@work/application/services/remove-released-archives.service';
import {
  InMemoryArchiveStore,
  InMemoryArchives,
} from '@work/application/services/workspace-archives.fake-spec';
import { WorkspaceArchive } from '@work/domain/aggregates/workspace-archive.aggregate';
import {
  anArchive,
  aSealedArchive,
  later,
} from '@work/domain/aggregates/workspace-archive.fake-spec';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { describe, expect, it, vi } from 'vitest';

const DAY = 24 * 60 * 60_000;

const setUp = async (due: ArchiveReferencesPort['due']) => {
  const archives = new InMemoryArchives();
  const store = new InMemoryArchiveStore();
  const logger = { error: vi.fn() };

  await archives.add(aSealedArchive({ id: 'gone' }));
  await archives.add(aSealedArchive({ id: 'owned' }));

  const service = new RemoveReleasedArchives(
    { due },
    archives,
    store,
    { now: () => later(DAY), sleep: async () => {} },
    logger as never,
  );

  return { archives, store, logger, service };
};

const sealedMeanwhile = (unsealed: WorkspaceArchive): WorkspaceArchive =>
  WorkspaceArchive.rehydrate({
    id: unsealed.id,
    workspaceId: unsealed.workspaceId,
    continuity: unsealed.continuity,
    holder: unsealed.holder,
    grantedTo: unsealed.grantedTo,
    size: unsealed.size,
    digest: unsealed.digest,
    grantedAt: unsealed.grantedAt,
    sealedAt: later(DAY - 1),
    version: unsealed.version + 1,
  });

describe('RemoveReleasedArchives', () => {
  it('asks for the archives due by the cutoffs the archive rules name', async () => {
    const due = vi.fn(async () => []);
    const { service } = await setUp(due);

    await service.workDue();

    expect(due).toHaveBeenCalledWith(
      WorkspaceArchive.removalCutoffs(later(DAY)),
      expect.any(Number),
    );
  });

  it('removes each archive its rule lets go of, from the record and then storage', async () => {
    const { archives, store, service } = await setUp(async () => [
      {
        id: WorkspaceArchiveId.of('gone'),
        facts: {
          holder: null,
          supersededAt: null,
          lastStartedFromAt: null,
          pinned: false,
        },
      },
      {
        id: WorkspaceArchiveId.of('owned'),
        facts: {
          holder: { kind: 'task', finished: false, changedAt: later(0) },
          supersededAt: null,
          lastStartedFromAt: null,
          pinned: false,
        },
      },
    ]);

    await service.workDue();

    expect(store.removed).toEqual(['gone']);
    expect([...archives.kept.keys()]).toEqual(['owned']);
  });

  it('keeps the object of an archive sealed while it was being removed', async () => {
    const { archives, store, logger, service } = await setUp(async () => [
      {
        id: WorkspaceArchiveId.of('late'),
        facts: {
          holder: { kind: 'task', finished: false, changedAt: later(0) },
          supersededAt: null,
          lastStartedFromAt: null,
          pinned: false,
        },
      },
    ]);
    const unsealed = anArchive({ id: 'late' });
    await archives.add(sealedMeanwhile(unsealed));
    archives.find = async () => unsealed;

    await service.workDue();

    expect(store.removed).toEqual([]);
    expect(archives.kept.get('late')?.isSealed).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('forgets the archive and says so when storage could not delete its object', async () => {
    const { archives, store, service, logger } = await setUp(async () => [
      {
        id: WorkspaceArchiveId.of('gone'),
        facts: {
          holder: null,
          supersededAt: null,
          lastStartedFromAt: null,
          pinned: false,
        },
      },
      {
        id: WorkspaceArchiveId.of('owned'),
        facts: {
          holder: null,
          supersededAt: null,
          lastStartedFromAt: null,
          pinned: false,
        },
      },
    ]);
    const remove = store.remove.bind(store);
    store.remove = async (archive) => {
      if (archive.id.value === 'gone') {
        throw new Error('storage is down');
      }
      await remove(archive);
    };

    await service.workDue();

    expect(store.removed).toEqual(['owned']);
    expect(archives.kept.size).toBe(0);
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ archive: 'gone', workspaceId: 'ws_1' }),
      'A removed workspace archive was left behind in storage',
    );
  });
});
