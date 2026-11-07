import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { MarkConversationReadHandler } from '@work/application/commands/handlers/mark-conversation-read.handler';
import { MarkConversationReadCommand } from '@work/application/commands/mark-conversation-read.command';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { ConversationLoader } from '@work/application/services/conversation-loader.service';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-30T09:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };

const delivery = (workspaceId = 'ws_1', backlogId = 'station_1') =>
  lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      stationOf({
        id: StationId.of(backlogId),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: '#a3a8b0',
        kind: 'backlog',
      }),
      stationOf({
        id: StationId.of('station_completed'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: '#a3a8b0',
        kind: 'completed',
      }),
    ],
  });

const waiting = () =>
  Task.add({
    line: delivery(),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    createdBy: UserId.of('user_1'),
    now: new Date('2026-08-30T08:00:00.000Z'),
    newId: () => 'task_1',
  }).askedAbout(
    {
      voice: Voice.station(),
      station: null,
      body: TaskNoteBody.of('Which queue should I drain?'),
      at: new Date('2026-08-30T08:30:00.000Z'),
    },
    null,
  );

let saved: Task | undefined;

const tasks = (found: Task | null) =>
  ({
    add: vi.fn(),
    save: vi.fn(async (each: Task) => {
      saved = each;
    }),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    placementsAt: vi.fn(async () => []),
    findByCorrelation: vi.fn(async () => []),
    holdingMark: vi.fn(async () => []),
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
    awaitingConnection: vi.fn(async () => []),
  }) satisfies TaskRepository & TaskPlacementsPort;

const lines = () =>
  ({
    find: vi.fn(async () => null),
    findByStation: vi.fn(async () => null),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => []),
    candidate: vi.fn(),
  }) satisfies LineMapsPort;

const read = (found: Task | null, by = 'user_1') => {
  const repository = tasks(found);
  const handler = new MarkConversationReadHandler(
    new ConversationLoader(repository, lines()),
    repository,
    clock,
  );

  return {
    repository,
    done: handler.execute(new MarkConversationReadCommand('task_1:0', by)),
  };
};

describe('MarkConversationRead', () => {
  beforeEach(() => {
    saved = undefined;
  });

  it('marks what was put to them as seen', async () => {
    await read(waiting()).done;

    expect(saved?.notes[0]?.readAt).toEqual(NOW);
  });

  it('does not write when it had already been read', async () => {
    const { repository, done } = read(waiting().read(NotePosition.of(0), NOW));
    await done;

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('will not let anyone but the person it belongs to read it', async () => {
    await expect(read(waiting(), 'user_2').done).rejects.toThrow(
      ApplicationError,
    );
  });

  it('rejects a task that is not there', async () => {
    await expect(read(null).done).rejects.toThrow(ApplicationError);
  });
});
