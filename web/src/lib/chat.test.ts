import { describe, expect, it } from 'vitest';
import {
  type ChatMessage,
  chatPath,
  momentsOf,
  promptHandedOver,
  targetStationHandedOver,
  tracesHandedOver,
  turnsOf,
} from '@/lib/chat';
import type { JournalStep, RunJournal } from '@/lib/inbox';

const message = (over: Partial<ChatMessage>): ChatMessage => ({
  position: 0,
  kind: 'message',
  body: 'Plan how retries back off.',
  at: '2026-09-14T09:00:00.000Z',
  author: null,
  runId: null,
  attachments: [],
  traces: [],
  proposal: null,
  ...over,
});

const step = (over: Partial<JournalStep>): JournalStep =>
  ({
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
  }) as JournalStep;

const journal = (steps: JournalStep[]): RunJournal =>
  ({ runId: 'run_1', attempt: 1, steps }) as unknown as RunJournal;

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
    );

    expect(moments.map((each) => each.kind)).toEqual(['message', 'worked']);
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
    );

    expect(moment?.kind).toBe('proposed');
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
