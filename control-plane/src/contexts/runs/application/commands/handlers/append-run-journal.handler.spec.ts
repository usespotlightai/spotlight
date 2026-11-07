import { AppendRunJournalHandler } from '@runs/application/commands/handlers/append-run-journal.handler';
import { AppendRunJournalCommand } from '@runs/application/commands/runner.commands';
import type { JournalEntry } from '@runs/application/ports/run-journal.port';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import type { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-17T09:00:00.000Z');

const leased = Run.enqueue({
  id: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  harness: HarnessId.of('dev'),
  ...orderedFor.spec(),
  spec: RunSpec.of({
    command: { executable: 'sh', args: [] },
    briefing: 'do the thing',
    handover: { options: [], noteLimit: 4_000 },
    resume: {},
  }),
})
  .claim(RunnerId.of('runner_1'), NOW)
  .expireLease(new Date(NOW.getTime() + 60_000))
  .claim(RunnerId.of('runner_1'), NOW);

const journalling = () => {
  const appended: { attempt: RunAttempt; entries: readonly JournalEntry[] }[] =
    [];
  const published: string[] = [];

  const handler = new AppendRunJournalHandler(
    { findById: async () => leased } as unknown as RunRepository,
    {
      append: async (attempt, entries) =>
        void appended.push({ attempt, entries }),
      appendControlPlaneEntry: async () => -1_000_000,
    },
    { publish: (runId: string) => void published.push(runId) } as never,
  );

  return { handler, appended, published };
};

const entry = {
  seq: 1,
  type: 'output',
  at: '2026-09-17T09:00:01.000Z',
  message: 'hello',
};

describe('AppendRunJournalHandler', () => {
  it('journals under the attempt the run is on, for the runner that leases it', async () => {
    const { handler, appended, published } = journalling();

    await handler.execute(
      new AppendRunJournalCommand('run_1', 'runner_1', [entry]),
    );

    expect(appended).toHaveLength(1);
    expect(appended[0]?.attempt.number).toBe(2);
    expect(appended[0]?.entries[0]?.at).toEqual(new Date(entry.at));
    expect(published).toEqual(['run_1']);
  });

  it('rejects another runner, and journals and streams nothing', async () => {
    const { handler, appended, published } = journalling();

    await expect(
      handler.execute(
        new AppendRunJournalCommand('run_1', 'runner_2', [entry]),
      ),
    ).rejects.toMatchObject({ kind: 'conflict' });

    expect(appended).toEqual([]);
    expect(published).toEqual([]);
  });
});
