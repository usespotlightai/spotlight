import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DigestRun } from '@work/application/events/handlers/digest-run.handler';
import type {
  RunDigest,
  RunDigestReaderPort,
} from '@work/application/ports/run-digest-reader.port';
import type { RunDigestWriterPort } from '@work/application/ports/run-digest-writer.port';
import type { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunDigested } from '@work/domain/events/run-digested.event';
import { Money } from '@work/domain/value-objects/money.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { describe, expect, it } from 'vitest';

const DIGEST: RunDigest = {
  ms: 60_000,
  steps: 12,
  faults: 1,
  used: 40_000,
  size: 200_000,
  cost: Money.of(0.42, 'USD'),
  tokens: Tokens.of({ input: 1_200, output: 900, cacheRead: 80_000 }),
};

const digesting = (held: Map<string, RunDigest>) => {
  const ensured: string[] = [];
  const writer: RunDigestWriterPort = {
    ensure: async (runIds) => {
      ensured.push(...runIds.map((each) => each.value));
      for (const each of runIds) {
        held.set(each.value, DIGEST);
      }
    },
    catchUp: async () => {},
  };
  const reader: RunDigestReaderPort = {
    forRuns: async (runIds) =>
      new Map(
        runIds.flatMap((each) => {
          const digest = held.get(each.value);
          return digest ? [[each.value, digest] as const] : [];
        }),
      ),
  };

  return { handler: new DigestRun(writer, reader), ensured };
};

const ended = {
  runId: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  taskId: TaskId.of('task_1'),
};

describe('DigestRun', () => {
  it('digests a completed run and says what it cost', async () => {
    const { handler, ensured } = digesting(new Map());

    const raised = await handler.onRunCompleted(
      ended as unknown as RunCompleted,
    );

    expect(ensured).toEqual(['run_1']);
    expect(raised).toEqual([
      new RunDigested(
        ended.runId,
        ended.workspaceId,
        ended.taskId,
        60_000,
        12,
        1,
        40_000,
        200_000,
        DIGEST.cost,
        DIGEST.tokens,
      ),
    ]);
  });

  it('digests an abandoned run the same way', async () => {
    const { handler } = digesting(new Map());

    const raised = await handler.onRunAbandoned(
      ended as unknown as RunAbandoned,
    );

    expect(raised).toHaveLength(1);
  });

  it('says nothing when no digest could be written', async () => {
    const reader: RunDigestReaderPort = { forRuns: async () => new Map() };
    const handler = new DigestRun(
      { ensure: async () => {}, catchUp: async () => {} },
      reader,
    );

    expect(
      await handler.onRunCompleted(ended as unknown as RunCompleted),
    ).toEqual([]);
  });
});
