import type { RunOrderContract } from '@runs/application/contracts/run-order.contract';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { OrderChatRun } from '@work/application/events/handlers/order-chat-run.handler';
import type { DispatchChat } from '@work/application/services/dispatch-chat.service';
import type { OrderedRun } from '@work/application/services/ordered-run';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import { ChatRunAssigned } from '@work/domain/events/chat-run-assigned.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-19T09:00:00.000Z');
const RUN = RunId.of('run_1');

const chat = Chat.start({
  lines: [],
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  startedBy: UserId.of('user_1'),
  harness: HarnessId.of('claude-code'),
  repositories: [Repository.of('acme/api')],
  body: ChatMessageBody.fromInput('Plan how retries back off.'),
  now: NOW,
  newId: () => 'chat_1',
}).assignRun(RUN, NOW);

const order = (resume: RunOrderContract['spec']['resume']) =>
  ({
    runId: RUN.value,
    workspaceId: 'ws_1',
    harness: 'claude-code',
    priority: 0,
    placement: { labelGroups: [], image: null },
    spec: {
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'The whole briefing.',
      handover: { options: [], noteLimit: 0 },
      resume,
    },
    requester: {
      owner: 'work',
      kind: 'chat',
      id: 'chat_1',
      token: '1',
      team: 'team_1',
    },
    policy: {
      holdsTurn: true,
      gated: false,
      actsBeyondItself: false,
      asks: 'requester',
      listed: true,
      exclusive: true,
    },
    workingCopy: {
      key: 'work/chat-chat_1',
      rejoinable: true,
      restores: 'always',
    },
    restore: null,
    extensions: {},
    apiGrant: null,
    tags: {},
    line: null,
    refusal: null,
  }) satisfies RunOrderContract;

const briefingStored = async (
  resume: RunOrderContract['spec']['resume'],
): Promise<string | null> => {
  const added: Dispatch[] = [];

  await new OrderChatRun(
    partial<ChatRepository>({ find: async () => chat }),
    partial<DispatchRepository>({
      find: async () => null,
      add: async (each: Dispatch) => {
        added.push(each);
      },
    }),
    partial<DispatchChat>({
      ordered: async () =>
        partial<OrderedRun>({
          order: order(resume),
          briefedMemories: BriefedMemories.none(),
        }),
    }),
    { now: () => NOW, sleep: async () => {} },
  ).on(new ChatRunAssigned(chat.id, chat.workspaceId, chat.startedBy, RUN, []));

  return added[0]?.briefing ?? null;
};

describe('OrderChatRun', () => {
  it('keeps the whole briefing for a run that starts a session', async () => {
    expect(await briefingStored({})).toBe('The whole briefing.');
  });

  it('keeps the follow-up the harness gets for a run that resumes its session', async () => {
    expect(
      await briefingStored({
        sessionId: 'session_1',
        followUp: 'Checks failed on web.',
      }),
    ).toBe('Checks failed on web.');
  });
});
