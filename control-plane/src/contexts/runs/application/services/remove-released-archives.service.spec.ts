import type { HeldWorkingCopy } from '@runs/application/ports/archive-holders.port';
import type {
  ArchiveDue,
  ArchiveReferencesPort,
} from '@runs/application/ports/archive-references.port';
import type {
  SnapshotRemoval,
  SnapshotRemovalsPort,
} from '@runs/application/ports/snapshot-removals.port';
import { ArchiveHolders } from '@runs/application/services/archive-holders.service';
import { RemoveReleasedArchives } from '@runs/application/services/remove-released-archives.service';
import {
  InMemoryArchiveStore,
  InMemoryArchives,
} from '@runs/application/services/working-copy-archives.fake-spec';
import { WorkingCopyArchive } from '@runs/domain/aggregates/working-copy-archive.aggregate';
import {
  aCompletedArchive,
  aCompletedSnapshotArchive,
  anArchive,
  GRANTED_AT,
  later,
} from '@runs/domain/aggregates/working-copy-archive.fake-spec';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import { describe, expect, it, vi } from 'vitest';

const DAY = 24 * 60 * 60_000;

const dueAs = (id: string, name = 'task-task_1'): ArchiveDue => ({
  id: WorkingCopyArchiveId.of(id),
  workingCopyKey: WorkingCopyKey.of('work', name),
  grantedAt: GRANTED_AT,
  supersededAt: null,
  lastStartedFromAt: null,
  pinned: false,
});

const holdingWork = (held: Readonly<Record<string, HeldWorkingCopy>>) => {
  const holders = new ArchiveHolders();

  holders.register({
    owner: 'work',
    heldOf: async (names) =>
      new Map(
        names.flatMap((name): [string, HeldWorkingCopy][] =>
          held[name] ? [[name, held[name]]] : [],
        ),
      ),
  });

  return holders;
};

const setUp = async (
  due: ArchiveReferencesPort['due'],
  holders: ArchiveHolders = holdingWork({}),
) => {
  const archives = new InMemoryArchives();
  const store = new InMemoryArchiveStore();
  const logger = { error: vi.fn() };
  const queued: SnapshotRemoval[] = [];
  const snapshots: SnapshotRemovalsPort = {
    queue: async (removal) => {
      queued.push(removal);
    },
    due: async () => queued,
    forget: async () => true,
  };

  await archives.add(aCompletedArchive({ id: 'gone' }));
  await archives.add(aCompletedArchive({ id: 'owned' }));

  const seen = new Map<string, ArchiveDue>();
  const service = new RemoveReleasedArchives(
    {
      due: async (...args) => {
        const page = await due(...args);
        for (const each of page.due) {
          seen.set(each.id.value, each);
        }
        return page;
      },
      of: async (id) => seen.get(id.value) ?? null,
    },
    {
      referencing: (_workspace, work) => work(),
      removing: (_workspace, work) => work(),
    },
    holders,
    archives,
    store,
    snapshots,
    { now: () => later(DAY), sleep: async () => {} },
    logger as never,
  );

  return { archives, store, logger, service, queued };
};

const completedMeanwhile = (
  incomplete: WorkingCopyArchive,
): WorkingCopyArchive =>
  WorkingCopyArchive.rehydrate({
    id: incomplete.id,
    workspaceId: incomplete.workspaceId,
    workingCopyKey: incomplete.workingCopyKey,
    grantedTo: incomplete.grantedTo,
    location: incomplete.location,
    grantedAt: incomplete.grantedAt,
    completedAt: later(DAY - 1),
    version: incomplete.version + 1,
  });

describe('RemoveReleasedArchives', () => {
  it('requests the archives due by the cutoffs the archive rules name, page after page', async () => {
    const page = [dueAs('gone'), dueAs('owned', 'task-task_2')];
    const due = vi
      .fn<ArchiveReferencesPort['due']>()
      .mockResolvedValueOnce({
        due: page,
        next: { grantedAt: GRANTED_AT, id: WorkingCopyArchiveId.of('owned') },
      })
      .mockResolvedValue({ due: [], next: null });
    const { service } = await setUp(
      due,
      holdingWork({
        'task-task_1': { released: false, changedAt: later(0) },
        'task-task_2': { released: false, changedAt: later(0) },
      }),
    );

    await service.processDue();
    await service.processDue();
    await service.processDue();

    expect(due).toHaveBeenNthCalledWith(
      1,
      WorkingCopyArchive.removalCutoffs(later(DAY)),
      null,
      expect.any(Number),
    );
    expect(due).toHaveBeenNthCalledWith(
      2,
      WorkingCopyArchive.removalCutoffs(later(DAY)),
      { grantedAt: GRANTED_AT, id: WorkingCopyArchiveId.of('owned') },
      expect.any(Number),
    );
    expect(due).toHaveBeenNthCalledWith(
      3,
      WorkingCopyArchive.removalCutoffs(later(DAY)),
      null,
      expect.any(Number),
    );
  });

  it('removes each archive whose holder is gone, from the record and then storage, and keeps one still held', async () => {
    const { archives, store, service } = await setUp(
      async () => ({
        due: [dueAs('gone', 'task-task_9'), dueAs('owned')],
        next: null,
      }),
      holdingWork({
        'task-task_1': { released: false, changedAt: later(0) },
      }),
    );

    await service.processDue();

    expect(store.removed).toEqual(['gone']);
    expect([...archives.stored.keys()]).toEqual(['owned']);
  });

  it('leaves the snapshot of a removed archive to a host of its store, as Spotlight cannot reach the store', async () => {
    const { archives, store, service, queued } = await setUp(async () => ({
      due: [dueAs('branched', 'task-task_9')],
      next: null,
    }));
    await archives.add(aCompletedSnapshotArchive({ id: 'branched' }));

    await service.processDue();

    expect([...archives.stored.keys()]).toEqual(['gone', 'owned']);
    expect(store.removed).toEqual([]);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.workspaceId.value).toBe('ws_1');
    expect(queued[0]).toMatchObject({
      archiveId: 'branched',
      store: 's3://team-a',
      snapshot: 'spotlight-branched',
      queuedAt: later(DAY),
    });
  });

  it('treats a working copy of an owner that holds nothing as held by nobody', async () => {
    const { store, service } = await setUp(
      async () => ({
        due: [
          {
            ...dueAs('gone'),
            workingCopyKey: WorkingCopyKey.of('replays', 'x'),
          },
        ],
        next: null,
      }),
      new ArchiveHolders(),
    );

    await service.processDue();

    expect(store.removed).toEqual(['gone']);
  });

  it('keeps the object of an archive completed while it was being removed', async () => {
    const { archives, store, logger, service } = await setUp(
      async () => ({ due: [dueAs('late')], next: null }),
      holdingWork({
        'task-task_1': { released: false, changedAt: later(0) },
      }),
    );
    const incomplete = anArchive({ id: 'late' });
    await archives.add(completedMeanwhile(incomplete));
    archives.find = async () => incomplete;

    await service.processDue();

    expect(store.removed).toEqual([]);
    expect(archives.stored.get('late')?.isCompleted).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('removes the archive record and says so when storage could not delete its object', async () => {
    const { archives, store, service, logger } = await setUp(async () => ({
      due: [dueAs('gone'), dueAs('owned')],
      next: null,
    }));
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
      'A removed working copy archive was left behind in storage',
    );
  });
});
