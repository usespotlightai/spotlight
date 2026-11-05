import type { MemberDirectoryPort } from '@identity/application/ports/member-directory.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ReceivedHappening } from '@work/application/mappers/happened.mapper';
import type { ChannelNoticesPort } from '@work/application/ports/channel-notices.port';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import { ChannelReplies } from '@work/application/rendering/channel-replies';
import {
  type ChannelAnswer,
  ChannelChats,
} from '@work/application/services/channel-chats.service';
import type { ChatDispatching } from '@work/application/services/chat-dispatch';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { ChatMark } from '@work/domain/value-objects/chat-mark.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { Happening } from '@work/domain/value-objects/happening.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-01T09:00:00.000Z');
const WORKSPACE = WorkspaceId.of('ws_1');
const TEAM = TeamId.of('team_1');
const ADA = UserId.of('user_ada');
const GRACE = UserId.of('user_grace');

const THREAD = Mark.of('slack.thread', 'C1:1700.1');
const CHANNEL = Mark.of('slack.channel', 'C1');
const MARKS = [ChatMark.finding(THREAD), ChatMark.ambient(CHANNEL)];

const mentioned = (
  said: string,
  { email = 'ada@example.com', harness = null as string | null } = {},
): ReceivedHappening & { chat: NonNullable<ReceivedHappening['chat']> } => ({
  payload: {
    happening: Happening.of('slack.app_mention'),
    summary: 'Mentioned Spotlight in Slack.',
    answers: false,
    state: 'raised',
  },
  correlationKeys: CorrelationKeys.of({ marks: [THREAD] }) as CorrelationKeys,
  anchor: said ? Anchor.of({ body: said }) : null,
  authorEmail: null,
  ourOwn: false,
  opens: null,
  chat: { email, harness, marks: MARKS },
  attachments: [],
});

const startedChat = () =>
  Chat.start({
    workspaceId: WORKSPACE,
    teamId: TEAM,
    startedBy: ADA,
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.fromInput('Why do retries fail?'),
    marks: MARKS,
    now: NOW,
    newId: () => 'chat_1',
  });

const proposingChat = () =>
  startedChat()
    .assignRun(RunId.of('run_1'), NOW)
    .propose({
      runId: RunId.of('run_1'),
      placement: ProposalPlacement.of({
        lineId: LineId.of('line_1'),
        stationId: StationId.of('station_1'),
      }),
      title: TaskTitle.of('Back off exponentially'),
      description: null,
      at: NOW,
    })
    .endRun(RunId.of('run_1'));

const channels = ({
  existing = null as Chat | null,
  member = true,
  images = [null, null] as readonly (string | null)[],
}: {
  existing?: Chat | null;
  member?: boolean;
  images?: readonly (string | null)[];
} = {}) => {
  const added: Chat[] = [];
  const saved: Chat[] = [];
  const notify = vi.fn(async () => undefined);
  const warn = vi.fn();
  const service = new ChannelChats(
    {
      findByMarks: vi.fn(async () => existing),
      add: vi.fn(async (chat: Chat) => {
        added.push(chat);
      }),
      save: vi.fn(async (chat: Chat) => {
        saved.push(chat);
      }),
    } as unknown as ChatRepository,
    {
      ofTeam: vi.fn(async () =>
        images.map((image) => ({
          repositories: { all: [Repository.of('acme/api')] },
          names: () => true,
          image: image ? RunnerImage.of(image) : null,
          runsIn: RunnerPlacement.anywhere(),
        })),
      ),
    } as unknown as LineRepository,
    {
      byEmail: vi.fn(async (_, email: string) =>
        email === 'ada@example.com'
          ? ADA
          : email === 'grace@example.com'
            ? GRACE
            : null,
      ),
    } satisfies MemberDirectoryPort,
    {
      findTeamForMember: vi.fn(async () =>
        member ? { teamId: 'team_1', workspaceId: 'ws_1' } : null,
      ),
    } as unknown as WorkspaceReaderPort,
    {
      catalogue: () => [{ id: 'claude-code' }, { id: 'codex' }],
    } as unknown as HarnessLaunchPort,
    HarnessId.of('claude-code'),
    {
      takenUp: vi.fn(async (chat: Chat) => chat),
    } as unknown as ChatDispatching,
    { notify } satisfies ChannelNoticesPort,
    { now: () => NOW } as ClockPort,
    { generate: () => 'chat_1' } as IdGeneratorPort,
    { info: vi.fn(), warn } as unknown as LoggerPort,
  );

  return { service, added, saved, notify, warn };
};

const refusalOf = (refusal: ChannelAnswer | null) => refusal?.body ?? null;

describe('ChannelChats', () => {
  it('starts a chat for the person on the team, with the repositories of its lines', async () => {
    const { service, added } = channels();

    expect(
      await service.reached(
        WORKSPACE,
        TEAM,
        mentioned('Why do retries fail?'),
        [],
      ),
    ).toBeNull();

    const [chat] = added;
    expect(chat?.startedBy).toEqual(ADA);
    expect(chat?.teamId).toEqual(TEAM);
    expect(chat?.harness).toEqual(HarnessId.of('claude-code'));
    expect(chat?.repositories).toEqual([Repository.of('acme/api')]);
    expect(chat?.marks).toEqual(MARKS);
    expect(chat?.messages[0]?.body.value).toBe('Why do retries fail?');
  });

  it('starts it on the harness the integration names', async () => {
    const { service, added } = channels();

    await service.reached(
      WORKSPACE,
      TEAM,
      mentioned('Why?', { harness: 'codex' }),
      [],
    );

    expect(added[0]?.harness).toEqual(HarnessId.of('codex'));
  });

  it('refuses a person who is not a member, or not on the team', async () => {
    expect(
      refusalOf(
        await channels().service.reached(
          WORKSPACE,
          TEAM,
          mentioned('Why?', { email: 'stranger@example.com' }),
          [],
        ),
      ),
    ).toBe(ChannelReplies.unknownPerson);
    expect(
      refusalOf(
        await channels({ member: false }).service.reached(
          WORKSPACE,
          TEAM,
          mentioned('Why?'),
          [],
        ),
      ),
    ).toBe(ChannelReplies.notInTeam);
  });

  it('refuses a mention with nothing said, or a harness Spotlight does not know', async () => {
    const { service, added } = channels();

    expect(
      refusalOf(await service.reached(WORKSPACE, TEAM, mentioned(''), [])),
    ).toBe(ChannelReplies.nothingSaid);
    expect(
      refusalOf(
        await service.reached(
          WORKSPACE,
          TEAM,
          mentioned('Why?', { harness: 'gemini' }),
          [],
        ),
      ),
    ).toBe(ChannelReplies.unknownHarness('gemini'));
    expect(added).toEqual([]);
  });

  it('refuses a team whose lines run in different images', async () => {
    const { service, added } = channels({ images: ['node:22', 'python:3'] });

    expect(
      refusalOf(await service.reached(WORKSPACE, TEAM, mentioned('Why?'), [])),
    ).toBe(ChannelReplies.mixedImages);
    expect(added).toEqual([]);
  });

  it('refuses a person who is not a member in the thread of a chat', async () => {
    expect(
      refusalOf(
        await channels({ existing: startedChat() }).service.reached(
          WORKSPACE,
          TEAM,
          mentioned('Me too', { email: 'stranger@example.com' }),
          [],
        ),
      ),
    ).toBe(ChannelReplies.unknownPerson);
  });

  it('starts no chat for a word that no team reads', async () => {
    const { service, added } = channels();

    expect(
      await service.reached(WORKSPACE, null, mentioned('Why?'), []),
    ).toBeNull();
    expect(added).toEqual([]);
  });

  it('adds a reply in the thread to the chat it started', async () => {
    const { service, saved, added } = channels({ existing: startedChat() });

    await service.reached(WORKSPACE, TEAM, mentioned('And the queue?'), []);

    expect(added).toEqual([]);
    expect(saved[0]?.messages.map((each) => each.body.value)).toEqual([
      'Why do retries fail?',
      'And the queue?',
    ]);
  });

  it('lets only the starter talk to the chat', async () => {
    const { service, saved } = channels({ existing: startedChat() });

    expect(
      refusalOf(
        await service.reached(
          WORKSPACE,
          TEAM,
          mentioned('Me too', { email: 'grace@example.com' }),
          [],
        ),
      ),
    ).toBe(ChannelReplies.notTheStarter);
    expect(saved).toEqual([]);
  });

  it('accepts the open proposal from a reply', async () => {
    const { service, saved } = channels({ existing: proposingChat() });

    expect(
      await service.reached(WORKSPACE, TEAM, mentioned('accept'), []),
    ).toBeNull();

    expect(saved[0]?.openProposals).toEqual([]);
    expect(saved[0]?.pullEvents().map((each) => each.kind)).toContain(
      'chat.proposal-accepted',
    );
  });

  it('dismisses the open proposal from a reply', async () => {
    const { service, saved } = channels({ existing: proposingChat() });

    await service.reached(WORKSPACE, TEAM, mentioned('dismiss 1'), []);

    expect(saved[0]?.pullEvents().map((each) => each.kind)).toContain(
      'chat.proposal-dismissed',
    );
  });

  it('says why it cannot decide on a proposal', async () => {
    expect(
      refusalOf(
        await channels({ existing: startedChat() }).service.reached(
          WORKSPACE,
          TEAM,
          mentioned('accept'),
          [],
        ),
      ),
    ).toBe(ChannelReplies.noneOpen);
    expect(
      refusalOf(
        await channels({ existing: proposingChat() }).service.reached(
          WORKSPACE,
          TEAM,
          mentioned('accept 2'),
          [],
        ),
      ),
    ).toBe(ChannelReplies.noSuch(2));
  });

  it('logs a refusal it cannot post, and goes on', async () => {
    const { service, notify, warn } = channels();
    notify.mockRejectedValueOnce(new Error('no definitions'));

    await expect(
      service.answer({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        happened: mentioned('Why?'),
        event: 'chat.refused',
        body: ChannelReplies.notInTeam,
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('posts a refusal back to where it came from', async () => {
    const { service, notify } = channels();

    await service.answer({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      happened: mentioned('Why?'),
      event: 'chat.refused',
      body: ChannelReplies.notInTeam,
    });

    expect(notify).toHaveBeenCalledWith(
      {
        workspaceId: 'ws_1',
        teamId: 'team_1',
        marks: [
          { kind: 'slack.thread', value: 'C1:1700.1' },
          { kind: 'slack.channel', value: 'C1' },
        ],
        body: ChannelReplies.notInTeam,
        proposals: [],
        chatId: null,
        taskId: null,
      },
      'chat.refused',
    );
  });

  it('posts an acknowledgement back to where it came from', async () => {
    const { service, notify } = channels();

    await service.answer({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      happened: mentioned('Why?'),
      event: 'chat.acknowledged',
      body: '',
    });

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ body: '' }),
      'chat.acknowledged',
    );
  });
});
