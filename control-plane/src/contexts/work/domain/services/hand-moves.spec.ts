import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import {
  type HandMovedTask,
  HandMoves,
} from '@work/domain/services/hand-moves';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import {
  deliveryLineOf,
  lineMapOf,
  routesOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { Station } from '@work/domain/value-objects/station.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

let next = 0;
const line = deliveryLineOf({
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  newId: () => `id_${++next}`,
  harness: HarnessId.of('dev'),
});

const keyed = (key: string) =>
  line.stations.find((each) => each.key.value === key) as Station;

const LEON = UserId.of('user_leon');
const MAYA = UserId.of('user_maya');
const viewer = (person = LEON, actsOnTeam = true) => ({
  person,
  team: TeamStanding.of({
    seesTeam: true,
    actsOnTeam,
    memberOfTeam: actsOnTeam,
  }),
});

const at = (key: string): HandMovedTask => ({
  stationId: keyed(key).id,
  hold: null,
  awaiting: null,
});

const QUESTION = { ask: { approval: null, connectionAsk: null } };

const asking = (
  key: string,
  ask: NonNullable<HandMovedTask['awaiting']> = QUESTION,
): HandMovedTask => ({ ...at(key), awaiting: ask });

const movesOf = (task: HandMovedTask, seen = viewer()) =>
  Object.fromEntries(
    HandMoves.of(task, line, seen).map((each) => [
      each.to.key.value,
      {
        denial: each.denial,
        skips: each.skips.map((skipped) => skipped.name.value),
      },
    ]),
  );

describe('HandMoves', () => {
  it('starts work from the backlog at any work station, naming the stations it skips', () => {
    expect(movesOf(at('backlog'))).toEqual({
      backlog: { denial: null, skips: [] },
      triage: { denial: null, skips: [] },
      spec: { denial: null, skips: ['Triage'] },
      implementation: { denial: null, skips: ['Triage', 'Spec'] },
      'code-review': {
        denial: null,
        skips: ['Triage', 'Spec', 'Implementation'],
      },
      completed: { denial: null, skips: [] },
    });
  });

  it('parks or closes work at a work station, and leaves moving it on to runs', () => {
    expect(movesOf(at('implementation'))).toEqual({
      backlog: { denial: null, skips: [] },
      triage: { denial: 'between-work-stations', skips: [] },
      spec: { denial: 'between-work-stations', skips: [] },
      implementation: { denial: null, skips: [] },
      'code-review': { denial: 'between-work-stations', skips: [] },
      completed: { denial: null, skips: [] },
    });
  });

  it('keeps a completed task where it is', () => {
    const moves = movesOf(at('completed'));

    expect(moves.completed?.denial).toBeNull();
    expect(
      Object.entries(moves)
        .filter(([key]) => key !== 'completed')
        .map(([, move]) => move.denial),
    ).toEqual(Array(5).fill('out-of-completed'));
  });

  it('moves a task on hold only for a person who may end the hold', () => {
    const held = {
      ...at('implementation'),
      hold: { by: LEON, chat: ChatId.of('chat_1') },
    };

    expect(movesOf(held, viewer(LEON)).backlog?.denial).toBeNull();
    expect(movesOf(held, viewer(MAYA)).backlog?.denial).toBe('on-hold');
    expect(movesOf(held, viewer(MAYA)).implementation?.denial).toBeNull();
    expect(
      movesOf({ ...held, hold: { by: LEON, chat: null } }, viewer(MAYA, false))
        .completed?.denial,
    ).toBe('on-hold');
  });

  it('passes on a task that waits on a question to where its station passes work, as its agent could', () => {
    expect(movesOf(asking('triage'))).toEqual({
      backlog: { denial: null, skips: [] },
      triage: { denial: null, skips: [] },
      spec: { denial: null, skips: [] },
      implementation: { denial: null, skips: [] },
      'code-review': { denial: 'between-work-stations', skips: [] },
      completed: { denial: null, skips: [] },
    });
    expect(HandMoves.denial(asking('spec'), line, keyed('triage'), LEON)).toBe(
      'between-work-stations',
    );
    expect(
      HandMoves.denial(asking('spec'), line, keyed('implementation'), LEON),
    ).toBeNull();
  });

  it('passes on nothing while the task waits on an approval or a connection, or is on hold', () => {
    const approval = {
      ask: { approval: { open: true, askedOf: null }, connectionAsk: null },
    };
    const connection = {
      ask: {
        approval: null,
        connectionAsk: { met: false, personId: MAYA },
      },
    };
    const held = {
      ...asking('triage'),
      hold: { by: LEON, chat: null },
    };

    expect(movesOf(asking('triage', approval)).spec?.denial).toBe(
      'between-work-stations',
    );
    expect(movesOf(asking('triage', connection)).spec?.denial).toBe(
      'between-work-stations',
    );
    expect(movesOf(held, viewer(LEON)).spec?.denial).toBe(
      'between-work-stations',
    );
    expect(HandMoves.denial(held, line, keyed('spec'), LEON)).toBe(
      'between-work-stations',
    );
  });

  it('keeps a completed task completed, also where its station names a station to pass work to', () => {
    const station = (
      id: string,
      position: number,
      over: Partial<Parameters<typeof stationOf>[0]> = {},
    ) =>
      stationOf({
        id: StationId.of(id),
        key: StationKey.of(id),
        name: StationName.of(id),
        position,
        color: '#a3a8b0',
        ...over,
      });
    const odd = lineMapOf({
      id: LineId.of('line_odd'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      key: LineKey.of('odd'),
      name: LineName.of('Odd'),
      stations: [
        station('backlog', 0, { kind: 'backlog' }),
        station('work', 1, { harness: HarnessId.of('dev') }),
        station('closed', 2, {
          kind: 'completed',
          routes: routesOf({ stations: [StationId.of('work')] }),
        }),
      ],
    });
    const done = odd.stationAt(StationId.of('closed'));
    const work = odd.stationAt(StationId.of('work'));

    expect(
      HandMoves.denial(
        { stationId: StationId.of('closed'), hold: null, awaiting: QUESTION },
        odd,
        work as Station,
        LEON,
      ),
    ).toBe('out-of-completed');
    expect(done).not.toBeNull();
  });

  it('offers no moves off its line', () => {
    expect(HandMoves.of(at('backlog'), null, viewer())).toEqual([]);
  });

  it('refuses the mover a move the way it refuses the viewer', () => {
    const chatHeld = {
      ...at('implementation'),
      hold: { by: LEON, chat: ChatId.of('chat_1') },
    };
    const turnHeld = {
      ...at('implementation'),
      hold: { by: LEON, chat: null },
    };
    const denial = (task: HandMovedTask, to: string, mover = LEON) =>
      HandMoves.denial(task, line, keyed(to), mover);

    expect(denial(chatHeld, 'backlog', MAYA)).toBe('on-hold');
    expect(denial(chatHeld, 'implementation', MAYA)).toBeNull();
    expect(denial(chatHeld, 'backlog', LEON)).toBeNull();
    expect(denial(turnHeld, 'completed', MAYA)).toBeNull();
    expect(denial(chatHeld, 'spec', LEON)).toBe('between-work-stations');
    expect(denial(at('completed'), 'backlog')).toBe('out-of-completed');
    expect(denial(at('backlog'), 'code-review')).toBeNull();
  });

  it('refuses a mover whose task is on no station of the line', () => {
    expect(() =>
      HandMoves.denial(
        { stationId: StationId.of('elsewhere'), hold: null, awaiting: null },
        line,
        keyed('backlog'),
        LEON,
      ),
    ).toThrow(UnknownStationError);
  });

  it('offers exactly the moves a task takes, finished or not', () => {
    const taskAt = (from: Station, finished: boolean) =>
      Task.rehydrate({
        ...Task.add({
          line,
          at: keyed('backlog').id,
          title: TaskTitle.of('Fix the queue'),
          rank: TaskRank.of('i'),
          now: new Date('2026-08-27T09:15:00.000Z'),
          newId: () => 'task_1',
        }),
        stationId: from.id,
        finishedAt: finished ? new Date('2026-08-27T09:15:30.000Z') : null,
      });
    const takes = (from: Station, to: Station, finished: boolean) => {
      try {
        taskAt(from, finished).moveTo(
          line,
          to.id,
          TaskRank.of('m'),
          {
            line,
            body: TaskNoteBody.of('Moved.'),
            at: new Date('2026-08-27T09:16:00.000Z'),
            voice: Voice.station(),
          },
          { mover: LEON },
        );
        return true;
      } catch {
        return false;
      }
    };

    for (const finished of [false, true]) {
      for (const from of line.stations) {
        for (const move of HandMoves.of(
          { stationId: from.id, hold: null, awaiting: null },
          line,
          viewer(),
        ).filter((each) => !each.to.id.equals(from.id))) {
          expect([
            finished,
            from.key.value,
            move.to.key.value,
            move.denial === null,
          ]).toEqual([
            finished,
            from.key.value,
            move.to.key.value,
            takes(from, move.to, finished),
          ]);
        }
      }
    }
  });
});
