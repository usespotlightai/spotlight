import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ReadInboxItemHandler } from '@work/application/commands/handlers/read-inbox-item.handler';
import { ReadInboxItemCommand } from '@work/application/commands/read-inbox-item.command';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { ConversationAtHand } from '@work/application/services/conversation-at-hand.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-30T09:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };

const delivery = (workspaceId = 'ws_1', standsAt = 'station_1') =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      Station.of({
        id: StationId.of(standsAt),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of('station_completed'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
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
    raisedBy: UserId.of('user_1'),
    now: new Date('2026-08-30T08:00:00.000Z'),
    newId: () => 'task_1',
  }).askedAbout(
    {
      voice: Voice.station(),
      station: StationName.of('Triage'),
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
    standingAt: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
    holding: vi.fn(async () => null),
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
  }) satisfies TaskRepository & TaskPlacementsPort;

const lines = () =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => null),
    holding: vi.fn(async () => null),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => []),
    withRole: vi.fn(async () => null),
  }) satisfies LineRepository;

const read = (found: Task | null, by = 'user_1') => {
  const repository = tasks(found);
  const handler = new ReadInboxItemHandler(
    new ConversationAtHand(repository, lines()),
    repository,
    clock,
  );

  return {
    repository,
    done: handler.execute(new ReadInboxItemCommand('task_1:0', by)),
  };
};

describe('ReadInboxItem', () => {
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
    await expect(read(waiting(), 'user_2').done).rejects.toThrow(UseCaseFault);
  });

  it('refuses a task that is not there', async () => {
    await expect(read(null).done).rejects.toThrow(UseCaseFault);
  });
});
