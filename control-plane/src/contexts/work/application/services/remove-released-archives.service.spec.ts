import type { ArchiveStandingsPort } from '@work/application/ports/archive-standings.port';
import { RemoveReleasedArchives } from '@work/application/services/remove-released-archives.service';
import {
  InMemoryArchiveStore,
  InMemoryArchives,
} from '@work/application/services/workspace-archives.fake-spec';
import {
  aSealedArchive,
  later,
} from '@work/domain/aggregates/workspace-archive.fake-spec';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { describe, expect, it, vi } from 'vitest';

const DAY = 24 * 60 * 60_000;

const setUp = async (due: ArchiveStandingsPort['due']) => {
  const archives = new InMemoryArchives();
  const store = new InMemoryArchiveStore();
  const logger = { error: vi.fn() };

  await archives.add(aSealedArchive({ id: 'gone' }));
  await archives.add(aSealedArchive({ id: 'held' }));

  const service = new RemoveReleasedArchives(
    { due },
    archives,
    store,
    { now: () => later(DAY), sleep: async () => {} },
    logger as never,
  );

  return { archives, store, logger, service };
};

describe('RemoveReleasedArchives', () => {
  it('removes each archive its rule lets go of, from storage and then the record', async () => {
    const { archives, store, service } = await setUp(async () => [
      {
        id: WorkspaceArchiveId.of('gone'),
        facts: { holder: null, supersededAt: null },
      },
      {
        id: WorkspaceArchiveId.of('held'),
        facts: {
          holder: {
            stationId: StationId.of('station_1'),
            conversing: true,
            finished: false,
            changedAt: later(0),
          },
          supersededAt: null,
        },
      },
    ]);

    await service.workDue();

    expect(store.removed).toEqual(['gone']);
    expect([...archives.kept.keys()]).toEqual(['held']);
  });

  it('keeps going past an archive it could not remove', async () => {
    const { store, service, logger } = await setUp(async () => [
      {
        id: WorkspaceArchiveId.of('gone'),
        facts: { holder: null, supersededAt: null },
      },
      {
        id: WorkspaceArchiveId.of('held'),
        facts: { holder: null, supersededAt: null },
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

    expect(store.removed).toEqual(['held']);
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
