import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import type { WorkPort } from '@insights/application/ports/work.port';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import { RunTools } from '@insights/domain/value-objects/run-tools.vo';
import { RunUsage } from '@insights/domain/value-objects/run-usage.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface ServerCallsReceived {
  readonly server: string;
  readonly calls: number;
  readonly failed: number;
  readonly latency: readonly number[];
  readonly lastCallFailed: boolean;
}

export interface RunUsageReceived {
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string | null;
  readonly ms: number | null;
  readonly steps: number;
  readonly errors: number;
  readonly changedLines: number;
  readonly contextTokens: number | null;
  readonly contextWindow: number | null;
  readonly cost: number | null;
  readonly currency: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
  readonly servers: readonly ServerCallsReceived[];
  readonly skillsRead: readonly string[];
}

export class RecordRunUsageSummary {
  constructor(
    private readonly work: WorkPort,
    private readonly records: RunRecordRepository,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
  ) {}

  async usageRecorded(event: RunUsageReceived): Promise<void> {
    const usage = RunUsage.of({
      ms: event.ms,
      steps: event.steps,
      errors: event.errors,
      changedLines: event.changedLines,
      contextTokens: event.contextTokens,
      contextWindow: event.contextWindow,
      amount: event.cost,
      currency: event.currency,
      tokens: {
        input: event.inputTokens,
        output: event.outputTokens,
        cacheRead: event.cacheReadTokens,
        cacheWrite: event.cacheWriteTokens,
      },
    });

    const tools = RunTools.of({
      servers: event.servers.map((each) => ({
        ...each,
        latency: LatencyHistogram.of(each.latency),
      })),
      skillsRead: event.skillsRead,
    });

    const workspaceId = WorkspaceId.of(event.workspaceId);
    const taskId = event.taskId ? TaskId.of(event.taskId) : null;
    const run = await this.work.endedRun(event.runId);
    const teamId = run ? TeamId.of(run.teamId) : null;

    await this.transaction.inTransaction(async () => {
      await this.deletions.lockDeletion(workspaceId, taskId, teamId);
      const runId = RunId.of(event.runId);
      const existing = await this.records.of(runId);

      if (await this.deletions.isDeleted(workspaceId, taskId, teamId)) {
        if (existing && taskId) {
          await this.records.removeForTask(taskId);
        }
        return;
      }

      if (!existing) {
        await this.records.add(
          RunRecord.empty(runId, workspaceId, taskId).recordUsage(usage, tools),
        );
        return;
      }

      const recorded = existing.recordUsage(usage, tools);

      if (recorded !== existing) {
        await this.records.save(recorded);
      }
    });
  }
}
