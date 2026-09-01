import { ReadInboxItemHandler } from '@application/commands/handlers/read-inbox-item.handler';
import { ReadInboxItemCommand } from '@application/commands/read-inbox-item.command';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { ClockPort } from '@application/ports/clock.port';
import { ConversationAtHand } from '@application/services/conversation-at-hand.service';
import { Task } from '@domain/aggregates/task.aggregate';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { NotePosition } from '@domain/value-objects/note-position.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-30T09:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };

const waiting = () =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: new Date('2026-08-30T08:00:00.000Z'),
    newId: () => 'task_1',
  }).askedAbout({
    voice: Voice.station(),
    station: StationName.of('Triage'),
    body: TaskNoteBody.of('Which queue should I drain?'),
    at: new Date('2026-08-30T08:30:00.000Z'),
  });

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
    withPullRequest: vi.fn(async () => null),
    holding: vi.fn(async () => null),
  }) satisfies TaskRepository;

const lines = () =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => null),
    holding: vi.fn(async () => null),
  }) satisfies AssemblyLineRepository;

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
