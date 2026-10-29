import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatToolContext } from '@work/application/ports/integration-tools.port';
import type {
  StationChangeTestOutcome,
  StationChangeTestRequest,
} from '@work/application/ports/station-change-tests.port';
import { TestStationChangeToolUse } from '@work/application/services/test-station-change.tool-use';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TargetStation } from '@work/domain/value-objects/target-station.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-29T09:00:00.000Z');

const TARGET = TargetStation.rehydrate({
  teamId: TeamId.of('team_1'),
  lineId: LineId.of('line_1'),
  lineKey: LineKey.of('delivery'),
  lineName: LineName.of('Delivery'),
  stationId: StationId.of('station_1'),
  stationKey: StationKey.of('build'),
  stationName: StationName.of('Build'),
});

const CONTEXT: ChatToolContext = {
  kind: 'chat',
  runId: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  chatId: ChatId.of('chat_1'),
  teamId: TeamId.of('team_1'),
  requester: UserId.of('user_1'),
};

const using = (
  improving: boolean,
  answer: StationChangeTestOutcome = {
    outcome: 'started',
    mode: 'test',
    searchedTasks: 7,
    heldOutTasks: 3,
    iterations: 1,
  },
) => {
  const chat = Chat.start({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.of('Improve this station.'),
    targetStation: improving ? TARGET : null,
    now: NOW,
    newId: () => 'chat_1',
  });
  const asked: StationChangeTestRequest[] = [];
  const tool = new TestStationChangeToolUse(
    { find: async () => chat } as unknown as ChatRepository,
    {
      request: async (request: StationChangeTestRequest) => {
        asked.push(request);
        return answer;
      },
    },
  );

  return {
    asked,
    call: (inputs: Record<string, string>) =>
      tool.call(CONTEXT, ToolInputs.of(inputs)),
  };
};

const CHANGE = {
  name: 'shorter-prompt',
  hypothesis: 'Fewer missed tests.',
  config: '{"prompt": "Run the tests first."}',
};

describe('TestStationChangeToolUse', () => {
  it('asks for a test of the change at the station the chat improves, for the person of the chat', async () => {
    const { asked, call } = using(true);
    const answer = await call(CHANGE);

    expect(asked).toMatchObject([
      {
        lineId: 'line_1',
        stationId: 'station_1',
        mode: 'test',
        name: 'shorter-prompt',
        block: { prompt: 'Run the tests first.' },
      },
    ]);
    expect(asked[0]?.requester.value).toBe('user_1');
    expect(answer).toMatchObject({ started: true, mode: 'test' });
    expect((answer as { next: string }).next).toContain('on 7 searched tasks');
    expect((answer as { next: string }).next).toContain('inbox');
  });

  it('asks for a search when the agent names the search mode', async () => {
    const { asked, call } = using(true);

    await call({ ...CHANGE, mode: 'search' });

    expect(asked[0]?.mode).toBe('search');
  });

  it('says plainly that a change asked to search joined a running search as one candidate', async () => {
    const { call } = using(true, {
      outcome: 'joined',
      mode: 'search',
      iteration: 2,
      iterations: 3,
      searchedTasks: 7,
      heldOutTasks: 3,
    });
    const answer = (await call({ ...CHANGE, mode: 'search' })) as {
      outcome: string;
      next: string;
    };

    expect(answer.outcome).toBe('joined');
    expect(answer.next).toContain(
      'The change joined it as one candidate of iteration 2 of 3.',
    );
    expect(answer.next).toContain('no refinement of its own');
  });

  it('promises no refinement where a search has no iteration after the first', async () => {
    const { call } = using(true, {
      outcome: 'started',
      mode: 'search',
      iterations: 1,
      searchedTasks: 7,
      heldOutTasks: 3,
    });
    const answer = (await call({ ...CHANGE, mode: 'search' })) as {
      next: string;
    };

    expect(answer.next).not.toContain('refine');
  });

  it('refuses a chat that does not improve a station', async () => {
    const { asked, call } = using(false);

    expect(await call(CHANGE)).toMatchObject({
      started: false,
      refusal: 'not-improving',
      reason: 'This chat does not improve a station.',
    });
    expect(asked).toEqual([]);
  });

  it('refuses another station than the one the chat improves', async () => {
    const { asked, call } = using(true);

    expect(await call({ ...CHANGE, station: 'review' })).toMatchObject({
      started: false,
      refusal: 'other-station',
    });
    expect(asked).toEqual([]);
  });

  it('passes on why Spotlight cannot start, and asks for a Terraform diff instead', async () => {
    const { call } = using(true, {
      outcome: 'refused',
      code: 'pull-request-open',
      reason: 'A config pull request for the station is open.',
    });

    expect(await call(CHANGE)).toMatchObject({
      started: false,
      refusal: 'pull-request-open',
      reason: 'A config pull request for the station is open.',
      next: expect.stringContaining('Terraform diff'),
    });
  });
});
