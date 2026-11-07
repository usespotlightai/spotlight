import type { WorkPort } from '@insights/application/ports/work.port';
import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import { RunTools } from '@insights/domain/value-objects/run-tools.vo';
import { RunUsage } from '@insights/domain/value-objects/run-usage.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
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
  readonly listed: boolean;
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
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
  ) {}

  async usageRecorded(event: RunUsageReceived): Promise<void> {
    const taskRun = event.listed
      ? await this.work.taskRunOf(RunId.of(event.runId))
      : null;

    if (!taskRun) {
      return;
    }

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
    const taskId = taskRun.taskId;
    const teamId = taskRun.teamId;
    const runId = RunId.of(event.runId);

    await this.transaction.inTransaction(() =>
      this.recorder.record(this.records, {
        owner: FactOwner.of(workspaceId, { teamId, taskId }),
        erased: (existing) => existing.erased(),
        load: () => this.records.of(runId),
        fresh: () => RunRecord.empty(runId, workspaceId, taskId),
        change: (record) => record.recordUsage(usage, tools),
      }),
    );
  }
}
