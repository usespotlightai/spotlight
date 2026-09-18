import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { AnswerInboxItemCommand } from '@work/application/commands/answer-inbox-item.command';
import { AnswerInboxItemHandler } from '@work/application/commands/handlers/answer-inbox-item.handler';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { ConversationAtHand } from '@work/application/services/conversation-at-hand.service';
import { FilesAtHand } from '@work/application/services/files-at-hand.service';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-29T12:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };
const transaction: TransactionPort = { run: async (work) => work() };

const line = () =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    stations: [
      Station.of({
        id: StationId.of('station_0'),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of('station_1'),
        key: StationKey.of('triage'),
        name: StationName.of('Triage'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        harness: HarnessId.of('dev'),
      }),
      Station.of({
        id: StationId.of('station_2'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 2,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

const waiting = () =>
  Task.add({
    line: line(),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  }).askedAbout(
    {
      voice: Voice.station(),
      station: StationName.of('Triage'),
      body: TaskNoteBody.of('Which queue should I drain?'),
      at: NOW,
    },
    null,
  );

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
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
  }) satisfies TaskRepository & TaskPlacementsPort;

const lines = () =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => line()),
    holding: vi.fn(async () => line()),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => []),
    withRole: vi.fn(async () => null),
  }) satisfies LineRepository;

const dispatch: TaskDispatching = {
  runIdFor: async () => RunId.of('run_2'),
};

const files = new FilesAtHand({
  grant: vi.fn(),
  received: vi.fn(async (_at, given: readonly AttachmentId[]) =>
    given.map((id) =>
      Attachment.of({
        id: id.value,
        name: 'queue.png',
        contentType: 'image/png',
        size: 4096,
      }),
    ),
  ),
  keep: vi.fn(),
  link: vi.fn(),
  open: vi.fn(),
} satisfies AttachmentStorePort);

const answer = (
  found: Task,
  command = new AnswerInboxItemCommand('task_1:0', 'user_1', 'Cap it at 500.'),
) =>
  new AnswerInboxItemHandler(
    new ConversationAtHand(tasks(found), lines()),
    tasks(found),
    dispatch,
    transaction,
    clock,
    files,
  ).execute(command);

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

  it('takes files alone as an answer, naming them in the trail', async () => {
    await answer(
      waiting(),
      new AnswerInboxItemCommand('task_1:0', 'user_1', '  ', ['file_1']),
    );

    const last = saved?.notes[saved.notes.length - 1];
    expect(last?.body.value).toBe('Attached queue.png.');
    expect(last?.attachments.map((each) => each.id.value)).toEqual(['file_1']);
  });

  it('stops the task waiting and puts it back to work', async () => {
    await answer(waiting());

    expect(saved?.awaitingReview).toBe(false);
    expect(saved?.currentRunId).toEqual(RunId.of('run_2'));
  });

  it('starts nothing where a run is already working it', async () => {
    await answer(
      Task.rehydrate({ ...waiting(), currentRunId: RunId.of('run_1') }),
    );

    expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
  });

  it('refuses to answer a task nobody was asked about', async () => {
    const untouched = Task.add({
      line: line(),
      at: StationId.of('station_1'),
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
