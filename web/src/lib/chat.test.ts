import { describe, expect, it } from 'vitest';

import {
  type ChatMessage,
  type ChatPullRequest,
  chatPath,
  type Chat,
  decidedIn,
  momentsOf,
  pullRequestNameOf,
  pullRequestStationOf,
  pullRequestTitleOf,
  phaseOf,
  promptHandedOver,
  proposalStatusOf,
  type Proposal,
  sentTo,
  withoutMessage,
  runsOfTurn,
  targetStationHandedOver,
  tracesHandedOver,
  turnsOf,
} from '@/lib/chat';
import type { JournalledRun, JournalStep, RunJournal } from '@/lib/inbox';

const message = (over: Partial<ChatMessage>): ChatMessage => ({
  position: 0,
  kind: 'message',
  body: 'Plan how retries back off.',
  at: '2026-09-14T09:00:00.000Z',
  author: null,
  runId: null,
  takenUpBy: null,
  attachments: [],
  traces: [],
  proposal: null,
  pullRequest: null,
  ...over,
});

const step = (over: Partial<JournalStep>): JournalStep => ({
  kind: 'tool',
  text: 'src/queue.ts',
  status: 'completed',
  tool: 'read',
  detail: null,
  ms: 10,
  startedAt: '2026-09-14T09:00:01.000Z',
  locations: [],
  input: null,
  output: null,
  change: null,
  ...over,
});

const journal = (
  steps: JournalStep[],
  startedAt: string | null = null,
): RunJournal =>
  ({
    runId: 'run_1',
    attempt: 1,
    steps,
    marks: { startedAt },
  }) as unknown as RunJournal;

describe('momentsOf', () => {
  it('tells the chat in the order it happened', () => {
    const moments = momentsOf(
      [
        message({}),
        message({
          position: 1,
          kind: 'message',
          body: 'Split it up.',
          at: '2026-09-14T09:00:05.000Z',
        }),
      ],
      [
        journal([
          step({ startedAt: '2026-09-14T09:00:01.000Z' }),
          step({
            kind: 'message',
            text: 'Retries double.',
            startedAt: '2026-09-14T09:00:02.000Z',
          }),
          step({
            kind: 'message',
            text: 'Two tasks, then.',
            startedAt: '2026-09-14T09:00:06.000Z',
          }),
        ]),
      ],
      [],
    );

    expect(moments.map((each) => each.kind)).toEqual([
      'message',
      'worked',
      'answered',
      'message',
      'answered',
    ]);
  });

  it('never puts a run’s work before what started it, though its first step counts from the run being queued', () => {
    const moments = momentsOf(
      [message({ at: '2026-09-14T20:44:02.666Z' })],
      [
        journal([
          step({
            kind: 'hook',
            text: 'prepare',
            startedAt: '2026-09-14T20:44:02.665Z',
            ms: 1_700,
          }),
        ]),
      ],
      [],
    );

    expect(moments.map((each) => each.kind)).toEqual(['message', 'worked']);
  });

  it('keeps a running step before a proposal made while it runs', () => {
    const proposal = message({
      position: 1,
      kind: 'proposed',
      at: '2026-09-14T09:00:08.000Z',
      proposal: {
        lineId: 'line_1',
        lineName: 'Default',
        stationId: 'station_1',
        stationName: 'Backlog',
        stationColor: '#a3a8b0',
        stationPosition: 1,
        stationCount: 3,
        title: 'Back off exponentially',
        description: null,
        state: 'open',
        taskId: null,
      },
    });
    const running = (ms: number) =>
      momentsOf(
        [message({}), proposal],
        [
          journal([
            step({
              tool: 'execute',
              status: 'pending',
              startedAt: '2026-09-14T09:00:02.000Z',
              ms,
            }),
          ]),
        ],
        [],
      ).map((each) => each.key);

    expect(running(1_000)).toEqual(running(9_000));
    expect(running(9_000)).toEqual([
      'message:0',
      'worked:run_1:1:0',
      'message:1',
    ]);
  });

  it('keys each moment by what it is, so later moments keep their key', () => {
    const steps = [
      step({ startedAt: '2026-09-14T09:00:01.000Z' }),
      step({
        kind: 'message',
        text: 'Found it.',
        startedAt: '2026-09-14T09:00:03.000Z',
      }),
    ];
    const before = momentsOf([message({})], [journal(steps)], []);
    const after = momentsOf(
      [message({})],
      [
        journal([
          ...steps,
          step({ tool: 'grep', startedAt: '2026-09-14T09:00:04.000Z' }),
        ]),
      ],
      [],
    );

    expect(after.map((each) => each.key).slice(0, before.length)).toEqual(
      before.map((each) => each.key),
    );
  });

  it('gathers the agent’s work between its messages into one group', () => {
    const moments = momentsOf(
      [],
      [
        journal([
          step({ startedAt: '2026-09-14T09:00:01.000Z' }),
          step({ tool: 'grep', startedAt: '2026-09-14T09:00:02.000Z' }),
          step({
            kind: 'message',
            text: 'Found it.',
            startedAt: '2026-09-14T09:00:03.000Z',
          }),
          step({ tool: 'read', startedAt: '2026-09-14T09:00:04.000Z' }),
        ]),
      ],
      [],
    );

    expect(
      moments.map((each) => (each.kind === 'worked' ? each.steps.length : 0)),
    ).toEqual([2, 0, 1]);
  });

  it('keeps a proposal as a proposal, not as a message', () => {
    const [moment] = momentsOf(
      [
        message({
          kind: 'proposed',
          body: 'Back off exponentially',
          proposal: {
            lineId: 'line_1',
            lineName: 'Default',
            stationId: 'station_1',
            stationName: 'Backlog',
            stationColor: '#a3a8b0',
            stationPosition: 1,
            stationCount: 4,
            title: 'Back off exponentially',
            description: null,
            state: 'open',
            taskId: null,
          },
        }),
      ],
      [],
      [],
    );

    expect(moment?.kind).toBe('proposed');
  });
});

describe('a pull request the agent opened', () => {
  const PULL_REQUEST: ChatPullRequest = {
    taskId: 'task_1',
    url: 'https://github.com/acme/web/pull/7',
    state: 'held',
    lineName: 'Default',
    stationName: 'Code review',
    stationColor: '#edc12b',
    stationPosition: 3,
    stationCount: 5,
  };

  it('is a moment of the turn it was opened in, and what happened to it starts a turn', () => {
    const turns = turnsOf(
      momentsOf(
        [
          message({}),
          message({
            position: 1,
            kind: 'opened',
            body: 'Show video icons',
            at: '2026-09-14T09:00:05.000Z',
            runId: 'run_1',
            pullRequest: PULL_REQUEST,
          }),
          message({
            position: 2,
            kind: 'happened',
            body: 'Checks failed on web.',
            at: '2026-09-14T09:00:09.000Z',
          }),
        ],
        [],
        [],
      ),
    );

    expect(
      turns.map((turn) => [
        turn.message?.kind,
        turn.moments.map((each) => each.kind),
      ]),
    ).toEqual([
      ['message', ['opened']],
      ['happened', []],
    ]);
  });

  it('says where its task stands', () => {
    expect(pullRequestTitleOf(PULL_REQUEST)).toBe('On hold for this chat');
    expect(pullRequestTitleOf({ ...PULL_REQUEST, state: 'line' })).toBe(
      'Handed to the line',
    );
    expect(pullRequestStationOf(PULL_REQUEST)).toBe('Default › Code review');
    expect(pullRequestStationOf({ ...PULL_REQUEST, stationName: null })).toBe(
      null,
    );
  });

  it('is named by its repository and number', () => {
    expect(pullRequestNameOf(PULL_REQUEST.url)).toBe('acme/web#7');
    expect(pullRequestNameOf('https://example.com/7')).toBe(
      'https://example.com/7',
    );
  });
});

describe('turnsOf', () => {
  it('opens a turn at each message of the person, with what followed it', () => {
    const turns = turnsOf(
      momentsOf(
        [
          message({}),
          message({
            position: 1,
            body: 'Split it up.',
            at: '2026-09-14T09:00:05.000Z',
          }),
        ],
        [
          journal([
            step({
              kind: 'message',
              text: 'Retries double.',
              startedAt: '2026-09-14T09:00:02.000Z',
            }),
          ]),
        ],
        [],
      ),
    );

    expect(
      turns.map((turn) => [turn.message?.body, turn.moments.length]),
    ).toEqual([
      ['Plan how retries back off.', 1],
      ['Split it up.', 0],
    ]);
  });
});

describe('chatPath', () => {
  it('sits under the team’s agent', () => {
    expect(chatPath('acme', 'team_1', 'chat_1')).toBe(
      '/w/acme/team/team_1/agent/chat_1',
    );
  });
});

describe('tracesHandedOver', () => {
  it('takes the traces handed over with the page', () => {
    expect(
      tracesHandedOver({
        trail: [],
        traces: [{ taskId: 'task_1', title: 'Drain the stuck retry queues' }],
      }),
    ).toEqual([{ taskId: 'task_1', title: 'Drain the stuck retry queues' }]);
  });

  it('takes nothing where nothing, or nothing like a trace, was handed over', () => {
    expect(tracesHandedOver(null)).toEqual([]);
    expect(tracesHandedOver({ traces: 'task_1' })).toEqual([]);
    expect(tracesHandedOver({ traces: [{ taskId: 'task_1' }] })).toEqual([]);
  });
});

describe('promptHandedOver', () => {
  it('takes the question handed over with the station', () => {
    expect(promptHandedOver({ prompt: 'What should change?' })).toBe(
      'What should change?',
    );
  });

  it('takes nothing where no question, or a blank one, was handed over', () => {
    expect(promptHandedOver(null)).toBeNull();
    expect(promptHandedOver({ prompt: '  ' })).toBeNull();
    expect(promptHandedOver({ prompt: 42 })).toBeNull();
  });
});

describe('targetStationHandedOver', () => {
  const SPEC = {
    lineId: 'line_1',
    lineKey: 'delivery',
    lineName: 'Delivery',
    stationId: 'station_1',
    stationKey: 'spec',
    stationName: 'Spec',
  };

  it('takes the station handed over with the page', () => {
    expect(targetStationHandedOver({ trail: [], targetStation: SPEC })).toEqual(
      SPEC,
    );
  });

  it('keeps only what names the station', () => {
    expect(
      targetStationHandedOver({ targetStation: { ...SPEC, color: '#b36ae2' } }),
    ).toEqual(SPEC);
  });

  it('takes nothing where nothing, or nothing like a station, was handed over', () => {
    expect(targetStationHandedOver(null)).toBeNull();
    expect(targetStationHandedOver({ targetStation: 'station_1' })).toBeNull();
    expect(
      targetStationHandedOver({ targetStation: { stationId: 'station_1' } }),
    ).toBeNull();
  });
});

describe('runsOfTurn', () => {
  it('takes the run that took up the turn message', () => {
    expect(
      runsOfTurn({
        message: message({ takenUpBy: 'run_7' }),
        moments: [],
      }),
    ).toEqual(['run_7']);
  });

  it('takes no run before a run took up the message, or for the opening turn', () => {
    expect(runsOfTurn({ message: message({}), moments: [] })).toEqual([]);
    expect(runsOfTurn({ message: null, moments: [] })).toEqual([]);
    expect(runsOfTurn(undefined)).toEqual([]);
  });
});

const run = (over: Partial<JournalledRun>): JournalledRun => ({
  runId: 'run_1',
  createdAt: '2026-09-14T09:00:00.500Z',
  stepCount: 3,
  messageCount: 1,
  ...over,
});

describe('a run whose journal has not loaded', () => {
  it('holds its place after what started it, with its steps counted', () => {
    const moments = momentsOf([message({})], [], [run({})]);

    expect(moments).toEqual([
      expect.objectContaining({ kind: 'message' }),
      {
        kind: 'pending',
        key: 'pending:run_1',
        at: '2026-09-14T09:00:00.500Z',
        count: 3,
      },
    ]);
  });

  it('gives way to its steps once the journal loads', () => {
    const moments = momentsOf(
      [message({})],
      [journal([step({}), step({}), step({})])],
      [run({})],
    );

    expect(moments.map((each) => each.kind)).toEqual(['message', 'worked']);
  });

  it('holds no place when the run has no steps', () => {
    const moments = momentsOf(
      [message({})],
      [],
      [run({ stepCount: 0, messageCount: 1 })],
    );

    expect(moments.map((each) => each.kind)).toEqual(['message']);
  });
});

describe('sentTo', () => {
  const chat = (over: Partial<Chat> = {}): Chat =>
    ({ progress: null, messages: [message({})], ...over }) as unknown as Chat;
  const sent = {
    body: 'Split it up.',
    author: { id: 'user_1', name: 'Sam Rivera', image: null },
    attachments: [],
  };

  it('adds the message at the end and queues the agent', () => {
    const after = sentTo(chat(), sent, '2026-09-14T09:01:00.000Z');

    expect(after.progress).toBe('queued');
    expect(after.messages.at(-1)).toMatchObject({
      position: 1,
      kind: 'message',
      body: 'Split it up.',
      at: '2026-09-14T09:01:00.000Z',
      takenUpBy: null,
    });
  });

  it('keeps a run that is already working', () => {
    expect(
      sentTo(
        chat({ progress: 'in-progress' }),
        sent,
        '2026-09-14T09:01:00.000Z',
      ).progress,
    ).toBe('in-progress');
  });

  it('takes the message back out by its position', () => {
    const after = sentTo(chat(), sent, '2026-09-14T09:01:00.000Z');

    expect(withoutMessage(after, 1).messages).toEqual(chat().messages);
  });
});

describe('decidedIn', () => {
  it('changes only the proposal at that position', () => {
    const proposed = message({
      position: 1,
      kind: 'proposed',
      proposal: { state: 'open' } as ChatMessage['proposal'],
      pullRequest: null,
    });
    const chat = { messages: [message({}), proposed] } as unknown as Chat;

    const after = decidedIn(chat, 1, 'dismissed');

    expect(after.messages[0]).toBe(chat.messages[0]);
    expect(after.messages[1]?.proposal?.state).toBe('dismissed');
  });
});

describe('proposalStatusOf', () => {
  it('waits while the proposal is open and works while the task is created', () => {
    const of = (state: Proposal['state']) =>
      proposalStatusOf({ state } as Proposal);

    expect(of('open')).toBe('pending');
    expect(of('accepted')).toBe('working');
    expect(of('created')).toBe('approved');
    expect(of('replaced')).toBe('dismissed');
    expect(of('dismissed')).toBe('dismissed');
  });
});

describe('phaseOf', () => {
  it('prepares the workspace until the agent takes its first step', () => {
    const phase = phaseOf(
      [journal([step({ kind: 'hook', tool: null, text: 'restore' })])],
      'run_1',
    );

    expect(phase).toEqual({
      kind: 'preparing',
      key: 'run_1:preparing',
      since: Date.parse('2026-09-14T09:00:01.000Z'),
    });
    expect(phaseOf([], 'run_1')).toEqual({
      kind: 'preparing',
      key: 'run_1:preparing',
      since: null,
    });
  });

  it('counts the preparation from when the run started', () => {
    expect(
      phaseOf([journal([], '2026-09-14T08:59:58.000Z')], 'run_1').since,
    ).toBe(Date.parse('2026-09-14T08:59:58.000Z'));
  });

  it('names the hook that runs before the agent', () => {
    const setup = step({
      kind: 'hook',
      tool: null,
      text: 'setup',
      status: 'running',
      startedAt: '2026-09-14T09:00:04.000Z',
    });
    const phase = phaseOf(
      [journal([step({ kind: 'hook', tool: null, text: 'restore' }), setup])],
      'run_1',
    );

    expect(phase.kind === 'step' && phase.step).toBe(setup);
  });

  it('counts the hooks before the agent from when the run started, so the time only goes up', () => {
    const setup = step({
      kind: 'hook',
      tool: null,
      text: 'setup',
      status: 'running',
      startedAt: '2026-09-14T09:00:04.000Z',
    });

    expect(
      phaseOf([journal([setup], '2026-09-14T08:59:58.000Z')], 'run_1').since,
    ).toBe(Date.parse('2026-09-14T08:59:58.000Z'));
  });

  it('names the step that runs now', () => {
    const running = step({
      tool: 'execute',
      text: 'npm test',
      status: 'pending',
      startedAt: '2026-09-14T09:00:05.000Z',
    });

    expect(phaseOf([journal([step({}), running])], 'run_1')).toEqual({
      kind: 'step',
      step: running,
      key: 'run_1:step:2026-09-14T09:00:05.000Z:npm test',
      since: Date.parse('2026-09-14T09:00:05.000Z'),
    });
  });

  it('works on, with a new phase after each step, when none runs', () => {
    const steps = [
      step({}),
      step({
        kind: 'message',
        status: 'pending',
        startedAt: '2026-09-14T09:00:03.000Z',
        ms: 500,
      }),
    ];

    expect(phaseOf([journal(steps)], 'run_1')).toEqual({
      kind: 'working',
      key: 'run_1:working:2',
      since: Date.parse('2026-09-14T09:00:03.500Z'),
    });
    expect(phaseOf([journal([...steps, step({})])], 'run_1').key).toBe(
      'run_1:working:3',
    );
  });
});
