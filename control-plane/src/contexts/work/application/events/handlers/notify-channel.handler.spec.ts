import { runJournalReadings } from '@runs/application/ports/run-journal-readings.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BindableChatEvent } from '@work/application/contracts/bindable-chat-events.contract';
import { NotifyChannel } from '@work/application/events/handlers/notify-channel.handler';
import type {
  ChannelNoticeDto,
  ChannelNoticesPort,
} from '@work/application/ports/channel-notices.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import {
  requestedBy,
  runEnded,
  runExhausted,
} from '@work/application/ports/runs.fake-spec';
import { ChannelReplies } from '@work/application/rendering/channel-replies';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { ChatRunAssigned } from '@work/domain/events/chat-run-assigned.event';
import { ChatRunNotStarted } from '@work/domain/events/chat-run-not-started.event';
import { ChatStarted } from '@work/domain/events/chat-started.event';
import { ProposalDismissed } from '@work/domain/events/proposal-dismissed.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatMark } from '@work/domain/value-objects/chat-mark.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-01T09:00:00.000Z');
const WORKSPACE = WorkspaceId.of('ws_1');
const RUN = RunId.of('run_1');
const SECOND = MessagePosition.of(1);
const MARKS = [
  ChatMark.finding(Mark.of('slack.thread', 'C1:1700.1')),
  ChatMark.ambient(Mark.of('slack.channel', 'C1')),
];

const started = (marks: readonly ChatMark[] = MARKS) =>
  Chat.start({
    lines: [],
    workspaceId: WORKSPACE,
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_ada'),
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.fromInput('Why do retries fail?'),
    marks,
    now: NOW,
    newId: () => 'chat_1',
  });

const proposing = () =>
  started()
    .assignRun(RUN, NOW)
    .propose({
      runId: RUN,
      placement: ProposalPlacement.of({
        lineId: LineId.of('line_1'),
        stationId: StationId.of('station_1'),
      }),
      title: TaskTitle.of('Back off exponentially'),
      description: null,
      at: NOW,
    });

const subject = (chat: Chat) => requestedBy.chat(chat.id.value);

const notifying = (chat: Chat) => {
  const notify = vi.fn(
    async (_notice: ChannelNoticeDto, _event: BindableChatEvent) => undefined,
  );
  const handler = new NotifyChannel(
    { find: vi.fn(async () => chat) } as unknown as ChatRepository,
    {
      find: vi.fn(async () => ({
        name: LineName.of('Delivery'),
        stationAt: () => ({ name: StationName.of('Implementation') }),
      })),
    } as unknown as LineMapsPort,
    { notify } satisfies ChannelNoticesPort,
    {
      attemptsOfRun: async () =>
        said === null
          ? []
          : [
              {
                runId: RUN.value,
                attempt: 1,
                steps: [{ kind: 'message', text: said }],
              },
            ],
    } as unknown as RunJournalReaderPort,
    runJournalReadings(),
  );

  return { handler, notify };
};

let said: string | null = null;

const completed = (chat: Chat, lastWords: string | null) => {
  said = lastWords;

  return runEnded({
    runId: RUN.value,
    workspaceId: WORKSPACE.value,
    requester: subject(chat),
    endedAt: NOW.toISOString(),
  });
};

describe('NotifyChannel', () => {
  it('posts the last words of a run back to the thread of the chat', async () => {
    const chat = started();
    const { handler, notify } = notifying(chat);

    await handler.onRunEnded(completed(chat, 'They time out.'));

    expect(notify).toHaveBeenCalledWith(
      {
        workspaceId: 'ws_1',
        teamId: 'team_1',
        marks: [
          { kind: 'slack.thread', value: 'C1:1700.1' },
          { kind: 'slack.channel', value: 'C1' },
        ],
        body: 'They time out.',
        proposals: [],
        chatId: 'chat_1',
        taskId: null,
      },
      'chat.replied',
    );
  });

  it('lists the open proposals under the answer, with their line and station', async () => {
    const chat = proposing();
    const { handler, notify } = notifying(chat);

    await handler.onRunEnded(completed(chat, 'Here is a plan.'));

    const listed = [
      {
        number: 1,
        title: 'Back off exponentially',
        line: 'Delivery',
        station: 'Implementation',
      },
    ];

    expect(notify.mock.calls[0]?.[0].body).toBe(
      ChannelReplies.answered('Here is a plan.', listed),
    );
    expect(notify.mock.calls[0]?.[0].proposals).toEqual(listed);
  });

  it('says when a run is dispatched for the chat', async () => {
    const chat = started();
    const { handler, notify } = notifying(chat);

    await handler.onChatRunAssigned(new ChatRunAssigned(chat.id, RUN, []));

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ body: '', chatId: 'chat_1', proposals: [] }),
      'chat.dispatched',
    );
  });

  it('posts nothing for a chat that did not come from a channel', async () => {
    const chat = started([]);
    const { handler, notify } = notifying(chat);

    await handler.onRunEnded(completed(chat, 'They time out.'));
    await handler.onChatStarted(
      new ChatStarted(chat.id, WORKSPACE, chat.teamId, chat.startedBy, NOW),
    );

    expect(notify).not.toHaveBeenCalled();
  });

  it('says it started, and says when a run could not finish', async () => {
    const chat = started();
    const { handler, notify } = notifying(chat);

    await handler.onChatStarted(
      new ChatStarted(chat.id, WORKSPACE, chat.teamId, chat.startedBy, NOW),
    );
    await handler.onRunEnded(
      runExhausted({
        runId: RUN.value,
        workspaceId: WORKSPACE.value,
        requester: subject(chat),
        attempt: 1,
        expiredLeases: 0,
        endedAt: NOW.toISOString(),
      }),
    );

    expect(notify.mock.calls.map((call) => [call[1], call[0].body])).toEqual([
      ['chat.started', ''],
      ['chat.replied', ChannelReplies.failed],
    ]);
  });

  it('says when a run of the chat could not start', async () => {
    const chat = started();
    const { handler, notify } = notifying(chat);

    await handler.onRunNotStarted(new ChatRunNotStarted(chat.id, RUN));

    expect(notify.mock.calls[0]?.[0].body).toBe(ChannelReplies.failed);
  });

  it('links the task a proposal became, and says when one was dismissed', async () => {
    const chat = proposing();
    const { handler, notify } = notifying(chat);

    await handler.onTaskOpened(
      new TaskOpened(
        TaskId.of('task_9'),
        WORKSPACE,
        chat.teamId,
        LineId.of('line_1'),
        StationId.of('station_1'),
        chat.startedBy,
        NOW,
        false,
        ProposalOrigin.of({ chatId: chat.id, position: SECOND }),
      ),
    );
    await handler.onProposalDismissed(new ProposalDismissed(chat.id, SECOND));

    expect(
      notify.mock.calls.map((call) => [call[0].body, call[0].taskId]),
    ).toEqual([
      [ChannelReplies.created('Back off exponentially'), 'task_9'],
      [ChannelReplies.dismissed('Back off exponentially'), null],
    ]);
  });
});
