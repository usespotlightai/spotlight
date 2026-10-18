import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RecordRunUsage } from '@work/application/events/handlers/record-run-usage.handler';
import type { RunToolsReaderPort } from '@work/application/ports/run-tools-reader.port';
import type {
  RunUsage,
  RunUsageReaderPort,
} from '@work/application/ports/run-usage-reader.port';
import type { RunUsageWriterPort } from '@work/application/ports/run-usage-writer.port';
import { ReplayRunUsageRecorded } from '@work/domain/events/replay-run-usage-recorded.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { RunExhausted } from '@work/domain/events/run-exhausted.event';
import { RunUsageRecorded } from '@work/domain/events/run-usage-recorded.event';
import { SearchRunUsageRecorded } from '@work/domain/events/search-run-usage-recorded.event';
import { Money } from '@work/domain/value-objects/money.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { SearchId } from '@work/domain/value-objects/search-id.vo';
import { SearchIteration } from '@work/domain/value-objects/search-iteration.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { ToolUse } from '@work/domain/value-objects/tool-use.vo';
import { describe, expect, it } from 'vitest';

const NO_SPEND = {
  spendOf: async () => ({ costs: [], unpricedSessions: 0, called: false }),
};

const USAGE: RunUsage = {
  ms: 60_000,
  steps: 12,
  errors: 1,
  changedLines: 40,
  contextTokens: 40_000,
  contextWindow: 200_000,
  cost: Money.of(0.42, 'USD'),
  tokens: Tokens.of({ input: 1_200, output: 900, cacheRead: 80_000 }),
};

const TOOLS = ToolUse.of({
  servers: [
    {
      server: 'linear',
      calls: 2,
      failed: 1,
      latency: LatencyHistogram.timing([300, 900]),
      lastCallFailed: true,
    },
  ],
  skills: ['our-migrations'],
});

const recording = (stored: Map<string, RunUsage>) => {
  const ensured: string[] = [];
  const writer: RunUsageWriterPort = {
    ensure: async (runIds) => {
      ensured.push(...runIds.map((each) => each.value));
      for (const each of runIds) {
        stored.set(each.value, USAGE);
      }
    },
    catchUp: async () => {},
  };
  const reader: RunUsageReaderPort = {
    forRuns: async (runIds) =>
      new Map(
        runIds.flatMap((each) => {
          const usage = stored.get(each.value);
          return usage ? [[each.value, usage] as const] : [];
        }),
      ),
  };
  const tools: RunToolsReaderPort = {
    toolsFor: async (runId) => (stored.has(runId.value) ? TOOLS : null),
  };

  return {
    handler: new RecordRunUsage(writer, reader, tools, {
      spendOf: async () => ({
        costs: [USAGE.cost as Money],
        unpricedSessions: 0,
        called: true,
      }),
    }),
    ensured,
  };
};

const ended = {
  runId: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  taskId: TaskId.of('task_1'),
};

describe('RecordRunUsage', () => {
  it('records the usage of a completed run and says what it cost', async () => {
    const { handler, ensured } = recording(new Map());

    const raised = await handler.onRunCompleted(
      ended as unknown as RunCompleted,
    );

    expect(ensured).toEqual(['run_1']);
    expect(raised).toEqual([
      new RunUsageRecorded(
        ended.runId,
        ended.workspaceId,
        ended.taskId,
        60_000,
        12,
        1,
        40,
        40_000,
        200_000,
        USAGE.cost,
        USAGE.tokens,
        TOOLS,
      ),
    ]);
  });

  it('records the usage of an exhausted run the same way', async () => {
    const { handler } = recording(new Map());

    const raised = await handler.onRunExhausted(
      ended as unknown as RunExhausted,
    );

    expect(raised).toHaveLength(1);
  });

  it('says nothing when no usage could be written', async () => {
    const reader: RunUsageReaderPort = { forRuns: async () => new Map() };
    const handler = new RecordRunUsage(
      { ensure: async () => {}, catchUp: async () => {} },
      reader,
      { toolsFor: async () => null },
      NO_SPEND,
    );

    expect(
      await handler.onRunCompleted(ended as unknown as RunCompleted),
    ).toEqual([]);
  });

  const aReplay = {
    ...ended,
    taskId: null,
    subject: RunSubject.replay(
      RunId.of('run_0'),
      TaskId.of('task_1'),
      StationId.of('station_1'),
      TeamId.of('team_1'),
    ),
  };

  it('says what a replay cost as a replay’s usage, so no cost goes to a task', async () => {
    const { handler, ensured } = recording(new Map());

    const raised = await handler.onRunCompleted(
      aReplay as unknown as RunCompleted,
    );

    expect(ensured).toEqual(['run_1']);
    expect(raised).toEqual([
      new ReplayRunUsageRecorded(
        ended.runId,
        ended.workspaceId,
        RunId.of('run_0'),
        60_000,
        12,
        USAGE.changedLines,
        USAGE.cost,
        USAGE.tokens,
      ),
    ]);
  });

  it('still says the usage of a replay was recorded when no usage could be written, so its result is never awaited forever', async () => {
    const handler = new RecordRunUsage(
      { ensure: async () => {}, catchUp: async () => {} },
      { forRuns: async () => new Map() },
      { toolsFor: async () => null },
      NO_SPEND,
    );

    expect(
      await handler.onRunExhausted(aReplay as unknown as RunExhausted),
    ).toEqual([
      new ReplayRunUsageRecorded(
        ended.runId,
        ended.workspaceId,
        RunId.of('run_0'),
        null,
        0,
        null,
        null,
        Tokens.UNREPORTED,
      ),
    ]);
  });

  const aSearch = {
    ...ended,
    taskId: null,
    subject: RunSubject.search(
      SearchId.of('search_1'),
      SearchIteration.of(1),
      StationId.of('station_1'),
      TeamId.of('team_1'),
    ),
  };

  it('says what a search run cost as a search’s usage, even when no usage could be written', async () => {
    const { handler, ensured } = recording(new Map());

    expect(
      await handler.onRunCompleted(aSearch as unknown as RunCompleted),
    ).toEqual([
      new SearchRunUsageRecorded(
        ended.runId,
        ended.workspaceId,
        SearchId.of('search_1'),
        60_000,
        12,
        [USAGE.cost as Money],
        0,
        USAGE.tokens,
      ),
    ]);
    expect(ensured).toEqual(['run_1']);

    const unwritten = new RecordRunUsage(
      { ensure: async () => {}, catchUp: async () => {} },
      { forRuns: async () => new Map() },
      { toolsFor: async () => null },
      NO_SPEND,
    );

    expect(
      await unwritten.onRunExhausted(aSearch as unknown as RunExhausted),
    ).toEqual([
      new SearchRunUsageRecorded(
        ended.runId,
        ended.workspaceId,
        SearchId.of('search_1'),
        null,
        0,
        [],
        0,
        Tokens.UNREPORTED,
      ),
    ]);
  });
});
