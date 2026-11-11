import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { RunOrderContract } from '@runs/application/contracts/run-order.contract';
import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { recordingRuns } from '@work/application/ports/runs.fake-spec';
import type { BriefingContext } from '@work/application/ports/team-memories.port';
import type { TraceParentPort } from '@work/application/ports/trace-parent.port';
import { ChatToolExtensions } from '@work/application/services/chat-tool-extensions.service';
import { DispatchChat } from '@work/application/services/dispatch-chat.service';
import type { OrderedRun } from '@work/application/services/ordered-run';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { ChatRunAssigned } from '@work/domain/events/chat-run-assigned.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { SETUP_PULL_REQUEST } from '@work/domain/value-objects/built-in-tools';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ConfigFolder } from '@work/domain/value-objects/config-folder.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import {
  lineMapOf,
  repositoryOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-23T09:00:00.000Z');
const API = Repository.of('acme/api');

const ends = (key: string, kind: 'backlog' | 'completed', position: number) =>
  stationOf({
    id: StationId.of(`${key}-${kind}`),
    key: StationKey.of(kind),
    name: StationName.of(kind),
    position,
    color: '#a3a8b0',
    kind,
  });

const line = (key: string, repositories: Repository[], runners: string[]) =>
  lineMapOf({
    id: LineId.of(key),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of(key),
    name: LineName.of(key),
    repositories: repositories.map((each) => repositoryOf(each)),
    placement: RunnerPlacement.of(runners),
    stations: [ends(key, 'backlog', 0), ends(key, 'completed', 1)],
  });

const chatIn = (
  repositories: Repository[],
  setup: ConfigFolder | null = null,
) =>
  Chat.start({
    lines: [],
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

const briefedAt: BriefingContext[] = [];
let memoryFails = false;

interface Ordering {
  readonly run: RunOrderContract;
  readonly ordered: OrderedRun;
}

const dispatching = (
  over: { launches?: boolean } = {},
): {
  dispatch: DispatchChat;
  enqueue: (
    chat: Chat,
    runId: RunId,
    handed: readonly MessagePosition[],
  ) => Promise<Ordering | null>;
} => {
  const runs = recordingRuns();
  const dispatch = new DispatchChat(
    { generate: () => 'id' } as IdGeneratorPort,
    {
      commandFor: () =>
        (over.launches ?? true)
          ? { executable: 'claude-agent-acp', args: [] }
          : null,
    } as unknown as HarnessLaunchPort,
    { forChat: () => '00-trace-span-01' } as unknown as TraceParentPort,
    { find: async () => null } as unknown as TeamDirectoryPort,
    {
      ofTeam: async () => [
        line('api', [API], ['vpc-internal']),
        line('web', [Repository.of('acme/web')], ['gpu']),
      ],
    } as unknown as LineMapsPort,
    { now: () => NOW, sleep: async () => {} } as ClockPort,
    {
      forBriefing: async (place: BriefingContext) => {
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
          omitted: [{ id: 'memory_2', handle: 'M-4' }],
          folder: {
            path: '.spotlight/memory',
            guide: '',
          },
        };
      },
    },
    {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    { inSavepoint: (work) => work() },
    'https://app.usespotlight.ai',
    { release: null },
    new ChatToolExtensions({
      find: async () => null,
    } as unknown as ChatRepository),
  );

  return {
    dispatch,
    enqueue: async (chat, runId, handed) => {
      const ordered = await dispatch.ordered(chat, runId, handed);

      if (!ordered) {
        return null;
      }

      await runs.enqueue(ordered.order);

      const [order] = runs.enqueue.mock.calls[0] ?? [];

      return order ? { run: order, ordered } : null;
    },
  };
};

const orderedFor = async (chat: Chat): Promise<Ordering> => {
  const ordering = await dispatching().enqueue(chat, RunId.of('run_1'), [
    MessagePosition.of(0),
  ]);

  if (!ordering) {
    throw new Error('the chat ordered no run');
  }

  return ordering;
};

const enqueued = async (chat: Chat): Promise<RunOrderContract> =>
  (await orderedFor(chat)).run;

const enables = (order: RunOrderContract, tool: Tool): boolean =>
  (order.spec.manifest ?? []).some((each) => each.name === tool.value);

const placementOf = (order: RunOrderContract): RunnerPlacement =>
  RunnerPlacement.ofLabelGroups(order.placement.labelGroups);

const dispatched = (chat: Chat, runId: RunId) => {
  const assigned = chat.assignRun(runId, NOW);
  const event = assigned
    .pullEvents()
    .find((each) => each instanceof ChatRunAssigned) as ChatRunAssigned;

  return { chat: assigned, handed: event.acknowledged };
};

describe('DispatchChat', () => {
  it('lets a setup chat’s run use Spotlight’s API and open its pull request', async () => {
    const run = await enqueued(
      chatIn(
        [API],
        ConfigFolder.of({ repository: 'acme/infra', folder: 'spotlight' }),
      ),
    );

    expect(run.spec.spotlightApi).toBe(true);
    expect(enables(run, SETUP_PULL_REQUEST)).toBe(true);
  });

  it('allows any other chat’s run neither', async () => {
    const run = await enqueued(chatIn([API]));

    expect(run.spec.spotlightApi).toBeUndefined();
    expect(enables(run, SETUP_PULL_REQUEST)).toBe(false);
  });

  it('places a chat run where the lines working in its repositories run', async () => {
    const run = await enqueued(chatIn([API]));

    expect(placementOf(run).matches(RunnerOffer.of(['vpc-internal']))).toBe(
      true,
    );
    expect(placementOf(run).matches(RunnerOffer.of(['gpu']))).toBe(false);
  });

  it('places a chat run working in no repository anywhere', async () => {
    expect(placementOf(await enqueued(chatIn([]))).isAnywhere).toBe(true);
  });

  it('briefs a resumed chat with what a run that ended without a session was handed', async () => {
    const resumed = chatIn([API])
      .assignRun(RunId.of('run_1'), NOW)
      .runEnded(RunId.of('run_1'), {
        session: HarnessSession.of('session_1'),
        claimedBy: null,
      })
      .chat.addMessage({
        by: UserId.of('user_1'),
        body: ChatMessageBody.of('Split it.'),
        at: NOW,
      });

    resumed.pullEvents();

    const first = dispatched(resumed, RunId.of('run_2'));
    const stuck = dispatching({ launches: false });
    expect(
      await stuck.dispatch.ordered(first.chat, RunId.of('run_2'), first.handed),
    ).toBeNull();

    const again = dispatched(
      first.chat.runEndedWithoutSession(RunId.of('run_2')).addMessage({
        by: UserId.of('user_1'),
        body: ChatMessageBody.of('Then the docs.'),
        at: NOW,
      }),
      RunId.of('run_3'),
    );
    const ordering = await dispatching().enqueue(
      again.chat,
      RunId.of('run_3'),
      again.handed,
    );

    expect(ordering?.run.spec.briefing).toBe('Split it.\n\nThen the docs.');
  });

  it('briefs a fresh chat with the team-wide memories, and records them on its run', async () => {
    briefedAt.length = 0;
    const { run, ordered } = await orderedFor(chatIn([API]));

    expect(briefedAt[0]).toMatchObject({ lineId: null, stationId: null });
    expect(ordered.briefedMemories.value).toEqual({
      briefed: [{ id: 'memory_1', handle: 'M-3' }],
      omitted: [{ id: 'memory_2', handle: 'M-4' }],
    });
    expect(run.spec.briefing).not.toContain('M-4');
    expect(run.spec.briefing).toContain('M-3');
  });

  it('still starts a chat, told nothing remembered, when memory cannot be read', async () => {
    memoryFails = true;
    const { run, ordered } = await orderedFor(chatIn([API]));
    memoryFails = false;

    expect(ordered.briefedMemories.value).toEqual({ briefed: [], omitted: [] });
    expect(run.spec.briefing).not.toContain('What the team has learned');
  });
});
