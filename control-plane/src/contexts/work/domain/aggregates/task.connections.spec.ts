import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { ConnectionAsk } from '@work/domain/value-objects/connection-ask.vo';
import { IntegrationName } from '@work/domain/value-objects/integration-name.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-05T10:00:00.000Z');
const RUN = RunId.of('run_1');
const TEAM = TeamId.of('team_1');
const ALICE = UserId.of('user_alice');
const BOB = UserId.of('user_bob');
const IMPLEMENTATION = StationId.of('station_implementation');

const station = (
  id: StationId,
  key: string,
  position: number,
  kind: 'backlog' | 'work' | 'completed',
) =>
  stationOf({
    id,
    key: StationKey.of(key),
    name: StationName.of(key),
    position,
    color: '#a3a8b0',
    kind,
  });

const line = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TEAM,
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    station(StationId.of('station_backlog'), 'backlog', 0, 'backlog'),
    station(IMPLEMENTATION, 'implementation', 1, 'work'),
    station(StationId.of('station_completed'), 'completed', 2, 'completed'),
  ],
});

const working = () =>
  Task.rehydrate({
    ...Task.add({
      line,
      at: IMPLEMENTATION,
      title: TaskTitle.of('Comment on ENG-12'),
      rank: TaskRank.of('i'),
      createdBy: BOB,
      now: NOW,
      newId: () => 'task_1',
    }),
    currentRunId: RUN,
  });

const ask = (personId = ALICE) =>
  ConnectionAsk.of({
    teamId: TEAM,
    integration: IntegrationName.of('linear'),
    integrationName: 'Linear',
    personId,
  });

const asking = {
  line: null,
  body: TaskNoteBody.of('Connect Linear and I will carry on.'),
  at: NOW,
  voice: Voice.station(RUN),
};

const CONNECTED = { line: null, at: NOW };

const asked = () => {
  const { task } = working().askToConnect(RUN, asking, ask());
  task.pullEvents();
  return task;
};

describe('Task connection asks', () => {
  it('puts the ask to the person whose connection is wanted, and waits on them', () => {
    const { task, asked: put } = working().askToConnect(RUN, asking, ask());
    const note = task.notes[task.notes.length - 1];

    expect(note?.form).toBe('connection');
    expect(note?.connectionAsk?.personId).toEqual(ALICE);
    expect(note?.connectionAsk?.met).toBe(false);
    expect(put).toBe(true);
    expect(task.assignee).toEqual(ALICE);
    expect(task.awaitingReview).toBe(true);
    expect(task.pullEvents()).toEqual([expect.any(TaskAsked)]);
  });

  it('does not ask twice while it already waits on that person for that connection', () => {
    const task = asked();

    expect(task.askToConnect(RUN, asking, ask())).toEqual({
      task,
      asked: true,
    });
  });

  it('says nobody was asked while it waits on something else', () => {
    const task = asked();

    expect(task.askToConnect(RUN, asking, ask(BOB))).toEqual({
      task,
      asked: false,
    });
    expect(
      task.askToConnect(
        RUN,
        asking,
        ConnectionAsk.of({
          teamId: TEAM,
          integration: IntegrationName.of('notion'),
          integrationName: 'Notion',
          personId: ALICE,
        }),
      ).asked,
    ).toBe(false);
  });

  it('rejects an ask from a run that is not its current run', () => {
    expect(() =>
      working().askToConnect(RunId.of('run_2'), asking, ask()),
    ).toThrow(InvalidTaskTransitionError);
  });

  it('is answered once the asked person connects that integration in that team, and the run is taken up', () => {
    const answered = asked().connectionMade(
      TEAM,
      IntegrationName.of('linear'),
      ALICE,
      CONNECTED,
    );

    expect(answered?.awaitingReview).toBe(false);
    expect(
      answered?.notes.find((each) => each.connectionAsk)?.connectionAsk?.met,
    ).toBe(true);
    expect(answered?.pullEvents()).toContainEqual(
      new TaskAnswered(TaskId.of('task_1'), WorkspaceId.of('ws_1'), RUN, null),
    );
  });

  it('is not answered by someone else connecting, or by another integration or team', () => {
    const task = asked();

    expect(
      task.connectionMade(TEAM, IntegrationName.of('linear'), BOB, CONNECTED),
    ).toBeNull();
    expect(
      task.connectionMade(TEAM, IntegrationName.of('notion'), ALICE, CONNECTED),
    ).toBeNull();
    expect(
      task.connectionMade(
        TeamId.of('team_2'),
        IntegrationName.of('linear'),
        ALICE,
        CONNECTED,
      ),
    ).toBeNull();
  });

  it('answers in the voice of the person who connected, naming the integration', () => {
    const answered = asked().connectionMade(
      TEAM,
      IntegrationName.of('linear'),
      ALICE,
      CONNECTED,
    );
    const note = answered?.notes[answered.notes.length - 1];

    expect(note?.voice.author).toEqual(ALICE);
    expect(note?.body.value).toBe('Connected Linear.');
  });

  it('is not answered twice', () => {
    const answered = asked().connectionMade(
      TEAM,
      IntegrationName.of('linear'),
      ALICE,
      CONNECTED,
    );

    expect(
      answered?.connectionMade(
        TEAM,
        IntegrationName.of('linear'),
        ALICE,
        CONNECTED,
      ),
    ).toBeNull();
  });
});
