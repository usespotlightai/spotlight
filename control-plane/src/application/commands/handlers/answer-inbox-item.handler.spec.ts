import { AnswerInboxItemCommand } from '@application/commands/answer-inbox-item.command';
import { AnswerInboxItemHandler } from '@application/commands/handlers/answer-inbox-item.handler';
import type { ClockPort } from '@application/ports/clock.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { ConversationAtHand } from '@application/services/conversation-at-hand.service';
import type { TaskDispatching } from '@application/services/task-dispatch';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-29T12:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };
const transaction: TransactionPort = { run: async (work) => work() };

const line = () =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations: [
      Station.of({
        id: StationId.of('station_0'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of('station_1'),
        name: StationName.of('Triage'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        harness: HarnessId.of('dev'),
      }),
      Station.of({
        id: StationId.of('station_2'),
        name: StationName.of('Completed'),
        position: 2,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

// Put to a person first: there is nothing to answer otherwise.
const waiting = () =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  }).askedAbout({
    voice: Voice.station(),
    station: StationName.of('Triage'),
    body: TaskNoteBody.of('Which queue should I drain?'),
    at: NOW,
  });

let saved: Task | undefined;

const tasks = (found: Task) =>
  ({
    add: vi.fn(),
    save: vi.fn(async (each: Task) => {
      saved = each;
    }),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    standingAt: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
    holding: vi.fn(async () => found),
  }) satisfies TaskRepository;

const lines = () =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => line()),
    holding: vi.fn(async () => line()),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => []),
    withRole: vi.fn(async () => null),
  }) satisfies AssemblyLineRepository;

const dispatch: TaskDispatching = {
  dispatch: async () => RunId.of('run_2'),
};

const answer = (found: Task) =>
  new AnswerInboxItemHandler(
    new ConversationAtHand(tasks(found), lines()),
    tasks(found),
    dispatch,
    transaction,
    clock,
  ).execute(new AnswerInboxItemCommand('task_1:0', 'user_1', 'Cap it at 500.'));

describe('AnswerInboxItem', () => {
  beforeEach(() => {
    saved = undefined;
  });

  it('adds what the person said to the trail, in their name', async () => {
    await answer(waiting());

    const last = saved?.notes[saved.notes.length - 1];
    expect(last?.body.value).toBe('Cap it at 500.');
    expect(last?.voice.author?.value).toBe('user_1');
    expect(last?.station.value).toBe('Triage');
  });

  it('stops the task waiting and puts it back to work', async () => {
    await answer(waiting());

    expect(saved?.awaitingReview).toBe(false);
    expect(saved?.currentRunId).toEqual(RunId.of('run_2'));
  });

  // Answering twice should not start a second run alongside the first.
  it('starts nothing where a run is already working it', async () => {
    await answer(waiting().handedTo(RunId.of('run_1')));

    expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
  });

  // Nothing was put to anyone, so there is nothing an answer could be to.
  it('refuses to answer a task nobody was asked about', async () => {
    const untouched = Task.add({
      workspaceId: WorkspaceId.of('ws_1'),
      stationId: StationId.of('station_1'),
      title: TaskTitle.of('Fix the queue'),
      rank: TaskRank.of('i'),
      raisedBy: UserId.of('user_1'),
      now: NOW,
      newId: () => 'task_1',
    });

    await expect(answer(untouched)).rejects.toThrow();
    expect(saved).toBeUndefined();
  });
});
