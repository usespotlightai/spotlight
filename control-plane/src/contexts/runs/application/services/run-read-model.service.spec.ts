import type { RunFactsReaderPort } from '@runs/application/ports/run-facts-reader.port';
import { RunReadModel } from '@runs/application/services/run-read-model.service';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type { WorkingCopyArchive } from '@runs/domain/aggregates/working-copy-archive.aggregate';
import {
  aCompletedArchive,
  anArchive,
} from '@runs/domain/aggregates/working-copy-archive.fake-spec';
import { StartingPoint } from '@runs/domain/value-objects/starting-point.vo';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const runOf = ({
  workspace = 'ws_1',
  startedFrom = null,
}: {
  workspace?: string;
  startedFrom?: string | null;
} = {}): Run =>
  partial<Run>({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of(workspace),
    startedFrom: nonEmpty(startedFrom)
      ? StartingPoint.of({
          archive: WorkingCopyArchiveId.of(startedFrom),
          checkouts: [],
          attempt: 1,
          at: new Date('2026-11-01T00:00:00.000Z'),
        })
      : null,
  });

const reading = ({
  run = runOf(),
  newest = null,
  archives = [],
}: {
  run?: Run | null;
  newest?: WorkingCopyArchive | null;
  archives?: readonly WorkingCopyArchive[];
}) =>
  new RunReadModel(
    partial<RunFactsReaderPort>({
      runs: async () => (run ? [run] : []),
      archives: async (ids: readonly WorkingCopyArchiveId[]) =>
        archives.filter((each) => ids.some((id) => id.equals(each.id))),
      newestArchiveOf: async () => newest,
    }),
  );

const RUN = RunId.of('run_1');

describe('RunReadModel', () => {
  describe('the archive a run can be restored from', () => {
    it('is the newest archive the run stored', async () => {
      const model = reading({
        run: runOf({ startedFrom: 'archive_started' }),
        newest: aCompletedArchive({ id: 'archive_ended' }),
        archives: [aCompletedArchive({ id: 'archive_started' })],
      });

      await expect(model.restorableFor(RUN)).resolves.toBe('archive_ended');
    });

    it('is the archive the run started from when it stored none itself', async () => {
      const model = reading({
        run: runOf({ startedFrom: 'archive_started' }),
        archives: [aCompletedArchive({ id: 'archive_started' })],
      });

      await expect(model.restorableFor(RUN)).resolves.toBe('archive_started');
    });

    it('is none when the archive it started from was never completed', async () => {
      const model = reading({
        run: runOf({ startedFrom: 'archive_started' }),
        archives: [anArchive({ id: 'archive_started' })],
      });

      await expect(model.restorableFor(RUN)).resolves.toBeNull();
    });

    it('is none when the archives belong to another workspace', async () => {
      const model = reading({
        run: runOf({ workspace: 'ws_2', startedFrom: 'archive_started' }),
        newest: aCompletedArchive({ id: 'archive_ended' }),
        archives: [aCompletedArchive({ id: 'archive_started' })],
      });

      await expect(model.restorableFor(RUN)).resolves.toBeNull();
    });

    it('is none for a run it does not know', async () => {
      await expect(
        reading({ run: null }).restorableFor(RUN),
      ).resolves.toBeNull();
    });
  });
});
