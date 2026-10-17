import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import { RunTools } from '@outcomes/domain/value-objects/run-tools.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface ServerCallsHeard {
  readonly server: string;
  readonly calls: number;
  readonly failed: number;
  readonly latency: readonly number[];
  readonly lastCallFailed: boolean;
}

export interface RunDigestHeard {
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string | null;
  readonly ms: number | null;
  readonly steps: number;
  readonly faults: number;
  readonly changedLines: number;
  readonly used: number | null;
  readonly size: number | null;
  readonly cost: number | null;
  readonly currency: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
  readonly servers: readonly ServerCallsHeard[];
  readonly skillsRead: readonly string[];
}

export class NoteRunDigested {
  constructor(
    private readonly work: WorkPort,
    private readonly records: RunRecordRepository,
    private readonly forgotten: ForgottenPort,
    private readonly transaction: TransactionPort,
  ) {}

  async digested(heard: RunDigestHeard): Promise<void> {
    const cost = RunCost.of({
      ms: heard.ms,
      steps: heard.steps,
      faults: heard.faults,
      changedLines: heard.changedLines,
      used: heard.used,
      size: heard.size,
      amount: heard.cost,
      currency: heard.currency,
      tokens: {
        input: heard.inputTokens,
        output: heard.outputTokens,
        cacheRead: heard.cacheReadTokens,
        cacheWrite: heard.cacheWriteTokens,
      },
    });

    const tools = RunTools.of({
      servers: heard.servers.map((each) => ({
        ...each,
        latency: LatencyHistogram.of(each.latency),
      })),
      skillsRead: heard.skillsRead,
    });

    const workspaceId = WorkspaceId.of(heard.workspaceId);
    const taskId = heard.taskId ? TaskId.of(heard.taskId) : null;
    const run = await this.work.endedRun(heard.runId);
    const teamId = run ? TeamId.of(run.teamId) : null;

    await this.transaction.inTransaction(async () => {
      await this.forgotten.lockForgetting(workspaceId, taskId, teamId);
      const runId = RunId.of(heard.runId);
      const existing = await this.records.of(runId);

      if (await this.forgotten.forgot(workspaceId, taskId, teamId)) {
        if (existing && taskId) {
          await this.records.removeForTask(taskId);
        }
        return;
      }

      if (!existing) {
        await this.records.add(
          RunRecord.heardOf(runId, workspaceId, taskId).recordDigest(
            cost,
            tools,
          ),
        );
        return;
      }

      const digested = existing.recordDigest(cost, tools);

      if (digested !== existing) {
        await this.records.save(digested);
      }
    });
  }
}
