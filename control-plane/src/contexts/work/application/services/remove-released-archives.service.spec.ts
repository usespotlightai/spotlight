import type { ArchiveReferencesPort } from '@work/application/ports/archive-references.port';
import { RemoveReleasedArchives } from '@work/application/services/remove-released-archives.service';
import {
  InMemoryArchiveStore,
  InMemoryArchives,
} from '@work/application/services/workspace-archives.fake-spec';
import { WorkspaceArchive } from '@work/domain/aggregates/workspace-archive.aggregate';
import {
  aCompletedArchive,
  anArchive,
  later,
} from '@work/domain/aggregates/workspace-archive.fake-spec';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { describe, expect, it, vi } from 'vitest';

const DAY = 24 * 60 * 60_000;

const setUp = async (due: ArchiveReferencesPort['due']) => {
  const archives = new InMemoryArchives();
  const store = new InMemoryArchiveStore();
  const logger = { error: vi.fn() };

  await archives.add(aCompletedArchive({ id: 'gone' }));
  await archives.add(aCompletedArchive({ id: 'owned' }));

  const service = new RemoveReleasedArchives(
    { due },
    archives,
    store,
    { now: () => later(DAY), sleep: async () => {} },
    logger as never,
  );

  return { archives, store, logger, service };
};

const completedMeanwhile = (incomplete: WorkspaceArchive): WorkspaceArchive =>
  WorkspaceArchive.rehydrate({
    id: incomplete.id,
    workspaceId: incomplete.workspaceId,
    resumeKey: incomplete.resumeKey,
    holder: incomplete.holder,
    grantedTo: incomplete.grantedTo,
    size: incomplete.size,
    digest: incomplete.digest,
    grantedAt: incomplete.grantedAt,
    completedAt: later(DAY - 1),
    version: incomplete.version + 1,
  });

describe('RemoveReleasedArchives', () => {
  it('requests the archives due by the cutoffs the archive rules name', async () => {
    const due = vi.fn(async () => []);
    const { service } = await setUp(due);

    await service.processDue();

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

    await service.processDue();

    expect(store.removed).toEqual(['gone']);
    expect([...archives.stored.keys()]).toEqual(['owned']);
  });

  it('keeps the object of an archive completed while it was being removed', async () => {
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
    const incomplete = anArchive({ id: 'late' });
    await archives.add(completedMeanwhile(incomplete));
    archives.find = async () => incomplete;

    await service.processDue();

    expect(store.removed).toEqual([]);
    expect(archives.stored.get('late')?.isCompleted).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('removes the archive record and says so when storage could not delete its object', async () => {
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

    await service.processDue();

    expect(store.removed).toEqual(['owned']);
    expect(archives.stored.size).toBe(0);
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ archive: 'gone', workspaceId: 'ws_1' }),
      'A removed workspace archive was left behind in storage',
    );
  });
});
