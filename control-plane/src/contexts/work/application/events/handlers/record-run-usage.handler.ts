import type { RunSpendReaderPort } from '@work/application/ports/run-spend-reader.port';
import type { RunToolsReaderPort } from '@work/application/ports/run-tools-reader.port';
import type { RunUsageReaderPort } from '@work/application/ports/run-usage-reader.port';
import type { RunUsageWriterPort } from '@work/application/ports/run-usage-writer.port';
import { ReplayRunUsageRecorded } from '@work/domain/events/replay-run-usage-recorded.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { RunExhausted } from '@work/domain/events/run-exhausted.event';
import { RunUsageRecorded } from '@work/domain/events/run-usage-recorded.event';
import { SearchRunUsageRecorded } from '@work/domain/events/search-run-usage-recorded.event';
import { agentSpendOf } from '@work/domain/services/agent-spend';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { ToolUse } from '@work/domain/value-objects/tool-use.vo';

type UsageRecorded =
  | RunUsageRecorded
  | ReplayRunUsageRecorded
  | SearchRunUsageRecorded;

export class RecordRunUsage {
  constructor(
    private readonly usages: RunUsageWriterPort,
    private readonly written: RunUsageReaderPort,
    private readonly tools: RunToolsReaderPort,
    private readonly spends: RunSpendReaderPort,
  ) {}

  onRunCompleted(event: RunCompleted): Promise<readonly UsageRecorded[]> {
    return this.usageRecorded(event);
  }

  onRunExhausted(event: RunExhausted): Promise<readonly UsageRecorded[]> {
    return this.usageRecorded(event);
  }

  private async usageRecorded(
    event: RunCompleted | RunExhausted,
  ): Promise<readonly UsageRecorded[]> {
    await this.usages.ensure([event.runId]);

    const searchId = event.subject?.searchId;

    if (searchId) {
      const usage = (await this.written.forRuns([event.runId])).get(
        event.runId.value,
      );
      const spend = agentSpendOf(await this.spends.spendOf(event.runId));

      return [
        new SearchRunUsageRecorded(
          event.runId,
          event.workspaceId,
          searchId,
          usage?.ms ?? null,
          usage?.steps ?? 0,
          spend.spentCosts,
          spend.unpricedCalls,
          usage?.tokens ?? Tokens.UNREPORTED,
        ),
      ];
    }

    const replayOf = event.subject?.replayOf;

    if (replayOf) {
      const usage = (await this.written.forRuns([event.runId])).get(
        event.runId.value,
      );

      return [
        new ReplayRunUsageRecorded(
          event.runId,
          event.workspaceId,
          replayOf,
          usage?.ms ?? null,
          usage?.steps ?? 0,
          usage?.changedLines ?? null,
          usage?.cost ?? null,
          usage?.tokens ?? Tokens.UNREPORTED,
        ),
      ];
    }

    const usage = (await this.written.forRuns([event.runId])).get(
      event.runId.value,
    );
    const tools = usage ? await this.tools.toolsFor(event.runId) : null;

    return usage
      ? [
          new RunUsageRecorded(
            event.runId,
            event.workspaceId,
            event.taskId,
            usage.ms,
            usage.steps,
            usage.errors,
            usage.changedLines,
            usage.contextTokens,
            usage.contextWindow,
            usage.cost,
            usage.tokens,
            tools ?? ToolUse.NONE,
          ),
        ]
      : [];
  }
}
