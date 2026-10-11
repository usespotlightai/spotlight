import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type { BriefingPlace } from '@work/application/ports/team-memories.port';
import type { TraceParentPort } from '@work/application/ports/trace-parent.port';
import { DispatchChat } from '@work/application/services/dispatch-chat.service';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Line } from '@work/domain/aggregates/line.aggregate';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { ChatHandedToRun } from '@work/domain/events/chat-handed-to-run.event';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { SETUP_PULL_REQUEST } from '@work/domain/services/built-in-tools';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ConfigHome } from '@work/domain/value-objects/config-home.vo';
import { HarnessCommand } from '@work/domain/value-objects/harness-command.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { WorkedRepository } from '@work/domain/value-objects/worked-repository.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-23T09:00:00.000Z');
const API = Repository.of('acme/api');

const ends = (key: string, kind: 'backlog' | 'completed', position: number) =>
  Station.of({
    id: StationId.of(`${key}-${kind}`),
    key: StationKey.of(kind),
    name: StationName.of(kind),
    position,
    color: StationColor.plain(),
    kind,
  });

const line = (key: string, repositories: Repository[], runners: string[]) =>
  Line.rehydrate({
    id: LineId.of(key),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of(key),
    name: LineName.of(key),
    repositories: repositories.map((each) => WorkedRepository.of(each)),
    placement: RunnerPlacement.of(runners),
    stations: [ends(key, 'backlog', 0), ends(key, 'completed', 1)],
  });

const chatIn = (repositories: Repository[], setup: ConfigHome | null = null) =>
  Chat.start({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('claude-code'),
    repositories,
    body: ChatMessageBody.of('Plan the retries.'),
    setup,
    now: NOW,
    newId: () => 'chat_1',
  });

const briefedAt: BriefingPlace[] = [];
let memoryFails = false;

const dispatching = (
  over: { launches?: boolean } = {},
): { dispatch: DispatchChat; added: () => Run } => {
  const add = vi.fn(async (_run: Run) => {});
  const dispatch = new DispatchChat(
    { add } as unknown as RunRepository,
    { generate: () => 'id' } as IdGeneratorPort,
    {
      commandFor: () =>
        (over.launches ?? true)
          ? HarnessCommand.of({ executable: 'claude-agent-acp' })
          : null,
    } as unknown as HarnessLaunchPort,
    { forChat: () => '00-trace-span-01' } as unknown as TraceParentPort,
    { find: async () => null } as unknown as TeamDirectoryPort,
    {
      ofTeam: async () => [
        line('api', [API], ['vpc-internal']),
        line('web', [Repository.of('acme/web')], ['gpu']),
      ],
    } as unknown as LineRepository,
    { now: () => NOW } as ClockPort,
    {
      forBriefing: async (place: BriefingPlace) => {
        briefedAt.push(place);
        if (memoryFails) {
          throw new Error('memory is down');
        }
        return {
          briefed: [
            {
              id: 'memory_1',
              handle: 'M-3',
              kind: 'preference',
              body: 'Name branches after the ticket.',
            },
          ],
          cut: [{ id: 'memory_2', handle: 'M-4' }],
          folder: { path: '.spotlight/memory', layout: [], mirroring: null },
        };
      },
    },
    {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    { isolated: (work) => work() },
  );

  return { dispatch, added: () => add.mock.calls[0]?.[0] as Run };
};

const enqueued = async (chat: Chat): Promise<Run> => {
  const { dispatch, added } = dispatching();

  await dispatch.enqueue(chat, RunId.of('run_1'), [MessagePosition.of(0)]);

  return added();
};

const handedTo = (chat: Chat, runId: RunId) => {
  const handed = chat.handedTo(runId, NOW);
  const [event] = handed.pullEvents();

  return { chat: handed, handed: (event as ChatHandedToRun).handed };
};

describe('DispatchChat', () => {
  it('lets a setup chat’s run reach Spotlight’s API and open its pull request', async () => {
    const run = await enqueued(
      chatIn(
        [API],
        ConfigHome.of({ repository: 'acme/infra', folder: 'spotlight' }),
      ),
    );

    expect(run.spec.wearsSpotlightApi).toBe(true);
    expect(run.spec.gives(SETUP_PULL_REQUEST)).toBe(true);
  });

  it('gives any other chat’s run neither', async () => {
    const run = await enqueued(chatIn([API]));

    expect(run.spec.wearsSpotlightApi).toBe(false);
    expect(run.spec.gives(SETUP_PULL_REQUEST)).toBe(false);
  });

  it('places a chat run where the lines working in its repositories run', async () => {
    const run = await enqueued(chatIn([API]));

    expect(run.placement.admits(RunnerTerms.of(['vpc-internal']))).toBe(true);
    expect(run.placement.admits(RunnerTerms.of(['gpu']))).toBe(false);
  });

  it('places a chat run working in no repository anywhere', async () => {
    expect((await enqueued(chatIn([]))).placement.isAnywhere).toBe(true);
  });

  it('briefs a resumed chat with what a run that kept nothing was handed', async () => {
    const resumed = chatIn([API])
      .handedTo(RunId.of('run_1'), NOW)
      .workedIn(HarnessSession.of('session_1'), null)
      .endedRun(RunId.of('run_1'))
      .said({
        by: UserId.of('user_1'),
        body: ChatMessageBody.of('Split it.'),
        at: NOW,
      });

    resumed.pullEvents();

    const first = handedTo(resumed, RunId.of('run_2'));
    const stuck = dispatching({ launches: false });
    expect(
      await stuck.dispatch.enqueue(first.chat, RunId.of('run_2'), first.handed),
    ).toBe(false);

    const again = handedTo(
      first.chat.runKeptNothing(RunId.of('run_2')).said({
        by: UserId.of('user_1'),
        body: ChatMessageBody.of('Then the docs.'),
        at: NOW,
      }),
      RunId.of('run_3'),
    );
    const { dispatch, added } = dispatching();
    await dispatch.enqueue(again.chat, RunId.of('run_3'), again.handed);

    expect(added().spec.briefing).toBe('Split it.\n\nThen the docs.');
  });

  it('briefs a fresh chat with the team-wide memories, and records them on its run', async () => {
    briefedAt.length = 0;
    const run = await enqueued(chatIn([API]));

    expect(briefedAt[0]).toMatchObject({ lineId: null, stationId: null });
    expect(run.briefedWith.value).toEqual({
      briefed: [{ id: 'memory_1', handle: 'M-3' }],
      cut: [{ id: 'memory_2', handle: 'M-4' }],
    });
    expect(run.spec.value.briefing).not.toContain('M-4');
    expect(run.spec.value.briefing).toContain('M-3');
  });

  it('still starts a chat, told nothing remembered, when memory cannot be read', async () => {
    memoryFails = true;
    const run = await enqueued(chatIn([API]));
    memoryFails = false;

    expect(run.briefedWith.value).toEqual({ briefed: [], cut: [] });
    expect(run.spec.value.briefing).not.toContain('What the team has learned');
  });
});
