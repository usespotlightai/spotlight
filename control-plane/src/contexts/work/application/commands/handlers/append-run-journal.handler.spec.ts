import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { AppendRunJournalHandler } from '@work/application/commands/handlers/append-run-journal.handler';
import { AppendRunJournalCommand } from '@work/application/commands/runner.commands';
import type { JournalEntry } from '@work/application/ports/run-journal.port';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-17T09:00:00.000Z');

const held = Run.enqueue({
  id: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  harness: HarnessId.of('dev'),
  spec: RunSpec.of({
    command: { executable: 'sh', args: [] },
    briefing: 'do the thing',
    handover: { options: [], noteLimit: 4_000 },
    continuity: { key: 'task:station' },
  }),
})
  .claim(RunnerId.of('runner_1'), NOW)
  .release()
  .claim(RunnerId.of('runner_1'), NOW);

const journalling = () => {
  const appended: { attempt: RunAttempt; entries: readonly JournalEntry[] }[] =
    [];
  const published: string[] = [];

  const handler = new AppendRunJournalHandler(
    { findById: async () => held } as unknown as RunRepository,
    {
      append: async (attempt, entries) =>
        void appended.push({ attempt, entries }),
      appendAside: async () => -1_000_000,
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
  it('journals under the attempt the run is on, for the runner holding it', async () => {
    const { handler, appended, published } = journalling();

    await handler.execute(
      new AppendRunJournalCommand('run_1', 'runner_1', [entry]),
    );

    expect(appended).toHaveLength(1);
    expect(appended[0]?.attempt.number).toBe(2);
    expect(appended[0]?.entries[0]?.at).toEqual(new Date(entry.at));
    expect(published).toEqual(['run_1']);
  });

  it('refuses another runner, and journals and streams nothing', async () => {
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
