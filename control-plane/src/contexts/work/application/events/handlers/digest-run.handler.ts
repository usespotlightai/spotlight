import type { RunDigestReaderPort } from '@work/application/ports/run-digest-reader.port';
import type { RunDigestWriterPort } from '@work/application/ports/run-digest-writer.port';
import type { RunSpendReaderPort } from '@work/application/ports/run-spend-reader.port';
import type { RunToolsReaderPort } from '@work/application/ports/run-tools-reader.port';
import { ReplayDigested } from '@work/domain/events/replay-digested.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunDigested } from '@work/domain/events/run-digested.event';
import type { RunExhausted } from '@work/domain/events/run-exhausted.event';
import { SearchDigested } from '@work/domain/events/search-digested.event';
import { agentSpendOf } from '@work/domain/services/agent-spend';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { ToolUse } from '@work/domain/value-objects/tool-use.vo';

type Digested = RunDigested | ReplayDigested | SearchDigested;

export class DigestRun {
  constructor(
    private readonly digests: RunDigestWriterPort,
    private readonly written: RunDigestReaderPort,
    private readonly tools: RunToolsReaderPort,
    private readonly spends: RunSpendReaderPort,
  ) {}

  onRunCompleted(event: RunCompleted): Promise<readonly Digested[]> {
    return this.digested(event);
  }

  onRunExhausted(event: RunExhausted): Promise<readonly Digested[]> {
    return this.digested(event);
  }

  private async digested(
    event: RunCompleted | RunExhausted,
  ): Promise<readonly Digested[]> {
    await this.digests.ensure([event.runId]);

    const searchId = event.subject?.searchId;

    if (searchId) {
      const digest = (await this.written.forRuns([event.runId])).get(
        event.runId.value,
      );
      const spend = agentSpendOf(await this.spends.spendOf(event.runId));

      return [
        new SearchDigested(
          event.runId,
          event.workspaceId,
          searchId,
          digest?.ms ?? null,
          digest?.steps ?? 0,
          spend.spentCosts,
          spend.unpricedCalls,
          digest?.tokens ?? Tokens.UNREPORTED,
        ),
      ];
    }

    const replayOf = event.subject?.replayOf;

    if (replayOf) {
      const digest = (await this.written.forRuns([event.runId])).get(
        event.runId.value,
      );

      return [
        new ReplayDigested(
          event.runId,
          event.workspaceId,
          replayOf,
          digest?.ms ?? null,
          digest?.steps ?? 0,
          digest?.changedLines ?? null,
          digest?.cost ?? null,
          digest?.tokens ?? Tokens.UNREPORTED,
        ),
      ];
    }

    const digest = (await this.written.forRuns([event.runId])).get(
      event.runId.value,
    );
    const tools = digest ? await this.tools.toolsFor(event.runId) : null;

    return digest
      ? [
          new RunDigested(
            event.runId,
            event.workspaceId,
            event.taskId,
            digest.ms,
            digest.steps,
            digest.faults,
            digest.changedLines,
            digest.used,
            digest.size,
            digest.cost,
            digest.tokens,
            tools ?? ToolUse.NONE,
          ),
        ]
      : [];
  }
}
