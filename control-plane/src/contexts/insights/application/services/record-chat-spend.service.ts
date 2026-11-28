import type { ChatsPort } from '@insights/application/ports/chats.port';
import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import type {
  RunRequester,
  WorkPort,
} from '@insights/application/ports/work.port';
import type { RunUsageReceived } from '@insights/application/services/record-run-usage-summary.service';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import { RunUsage } from '@insights/domain/value-objects/run-usage.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ChatUsageReceived extends RunUsageReceived {
  readonly requester: RunRequester;
}

export class RecordChatSpend {
  constructor(
    private readonly work: WorkPort,
    private readonly chats: ChatsPort,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
  ) {}

  async usageRecorded(event: ChatUsageReceived, at: Date): Promise<void> {
    const run = event.listed
      ? await this.work.chatRunOf(RunId.of(event.runId), event.requester)
      : null;

    if (!run) {
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

    await this.transaction.inTransaction(async () => {
      const tombstones = await this.deletions.tombstonesOf(
        FactOwner.of(run.workspaceId, { teamId: run.teamId }),
      );

      if (!tombstones.acceptsFacts) {
        return;
      }

      await this.chats.spent({
        runId: run.runId,
        chatId: run.chatId,
        workspaceId: run.workspaceId,
        teamId: run.teamId,
        harness: run.harness,
        model: run.model,
        repositories: run.repositories,
        spend: usage.spend,
        spentAt: at,
      });
    });
  }
}
