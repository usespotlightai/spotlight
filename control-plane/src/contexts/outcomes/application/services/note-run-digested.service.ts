import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunDigestHeard {
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string | null;
  readonly ms: number | null;
  readonly steps: number;
  readonly faults: number;
  readonly used: number | null;
  readonly size: number | null;
  readonly cost: number | null;
  readonly currency: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
}

export class NoteRunDigested {
  constructor(
    private readonly records: RunRecordRepository,
    private readonly forgotten: ForgottenPort,
    private readonly transaction: TransactionPort,
  ) {}

  digested(heard: RunDigestHeard): Promise<void> {
    const cost = RunCost.of({
      ms: heard.ms,
      steps: heard.steps,
      faults: heard.faults,
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

    const workspaceId = WorkspaceId.of(heard.workspaceId);
    const taskId = heard.taskId ? TaskId.of(heard.taskId) : null;

    return this.transaction.run(async () => {
      await this.forgotten.holding(workspaceId, taskId);
      const runId = RunId.of(heard.runId);
      const held = await this.records.of(runId);

      if (!held) {
        if (!(await this.forgotten.forgot(workspaceId, taskId))) {
          await this.records.add(
            RunRecord.heardOf(runId, workspaceId, taskId).digested(cost),
          );
        }
        return;
      }

      const digested = held.digested(cost);

      if (digested !== held) {
        await this.records.save(digested);
      }
    });
  }
}
