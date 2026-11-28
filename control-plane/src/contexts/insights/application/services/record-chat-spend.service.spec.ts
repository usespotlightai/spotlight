import { chatsInMemory } from '@insights/application/ports/chats.fake-spec';
import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import type { WorkPort } from '@insights/application/ports/work.port';
import {
  type ChatUsageReceived,
  RecordChatSpend,
} from '@insights/application/services/record-chat-spend.service';
import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';
import { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-11-27T09:00:00.000Z');

const inTransaction: TransactionPort = {
  inTransaction: async (work) => work(),
};

const WORK = partial<WorkPort>({
  chatRunOf: async (runId, requester) =>
    runId.value === 'run_chat' && requester.kind === 'chat'
      ? {
          runId,
          workspaceId: WorkspaceId.of('ws_1'),
          teamId: TeamId.of('team_1'),
          chatId: 'chat_1',
          harness: 'claude-code',
          model: null,
          repositories: [],
        }
      : null,
});

const usage = (change: Partial<ChatUsageReceived> = {}): ChatUsageReceived => ({
  runId: 'run_chat',
  workspaceId: 'ws_1',
  requester: { owner: 'work', kind: 'chat', id: 'chat_1', token: null },
  listed: true,
  ms: 1_000,
  steps: 1,
  errors: 0,
  changedLines: 0,
  contextTokens: null,
  contextWindow: null,
  cost: 0.3,
  currency: 'USD',
  inputTokens: null,
  outputTokens: null,
  cacheReadTokens: null,
  cacheWriteTokens: null,
  servers: [],
  skillsRead: [],
  ...change,
});

const recording = () => {
  const chats = chatsInMemory();
  const deletions = deletionsInMemory();

  return {
    chats,
    deletions,
    spend: new RecordChatSpend(WORK, chats, deletions, inTransaction),
  };
};

describe('RecordChatSpend', () => {
  it('keeps what a chat run cost, at the time its usage came', async () => {
    const { chats, spend } = recording();

    await spend.usageRecorded(usage(), AT);

    expect(chats.spending.get('run_chat')).toMatchObject({
      chatId: 'chat_1',
      spend: { amount: 0.3, currency: 'USD' },
      spentAt: AT,
    });
  });

  it('keeps a chat run that reports no price, with no spend', async () => {
    const { chats, spend } = recording();

    await spend.usageRecorded(usage({ cost: null, currency: null }), AT);

    expect(chats.spending.get('run_chat')?.spend).toBeNull();
  });

  it('passes Work the requester of the run, so Work can tell a task run without reading', async () => {
    const asked: unknown[] = [];
    const spend = new RecordChatSpend(
      partial<WorkPort>({
        chatRunOf: async (_runId, requester) => {
          asked.push(requester);

          return null;
        },
      }),
      chatsInMemory(),
      deletionsInMemory(),
      inTransaction,
    );
    const requester = {
      owner: 'work',
      kind: 'task',
      id: 'task_1',
      token: '0',
    };

    await spend.usageRecorded(usage({ requester }), AT);

    expect(asked).toEqual([requester]);
  });

  it('keeps nothing of a run of no chat, an unlisted run, or a team that was deleted', async () => {
    const unlisted = recording();
    const other = recording();
    const deleted = recording();

    await deleted.deletions.markDeleted(
      DeletionScope.ofTeam(WorkspaceId.of('ws_1'), TeamId.of('team_1')),
    );
    await unlisted.spend.usageRecorded(usage({ listed: false }), AT);
    await other.spend.usageRecorded(usage({ runId: 'run_task' }), AT);
    await deleted.spend.usageRecorded(usage(), AT);

    expect(unlisted.chats.spending.size).toBe(0);
    expect(other.chats.spending.size).toBe(0);
    expect(deleted.chats.spending.size).toBe(0);
  });

  it('refuses a negative cost', async () => {
    const { spend } = recording();

    await expect(spend.usageRecorded(usage({ cost: -1 }), AT)).rejects.toThrow(
      InvalidOutcomeError,
    );
  });
});
