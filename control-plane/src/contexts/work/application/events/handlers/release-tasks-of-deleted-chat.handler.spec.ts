import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ReleaseTasksOfDeletedChat } from '@work/application/events/handlers/release-tasks-of-deleted-chat.handler';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { ChatDeleted } from '@work/domain/events/chat-deleted.event';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-19T09:00:00.000Z');
const LATER = new Date('2026-11-19T10:00:00.000Z');
const LEON = UserId.of('user_leon');
const CHAT = ChatId.of('chat_1');
const SHIP = StationId.of('station_ship');

const station = (
  id: string,
  key: string,
  position: number,
  extra: Partial<Parameters<typeof stationOf>[0]> = {},
) =>
  stationOf({
    id: StationId.of(id),
    key: StationKey.of(key),
    name: StationName.of(key),
    position,
    color: '#a3a8b0',
    ...extra,
  });

const LINE = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    station('station_backlog', 'backlog', 0, { kind: 'backlog' }),
    station('station_ship', 'ship', 1, {
      harness: HarnessId.of('dev'),
      tools: [Tool.of('pull-request')],
    }),
    station('station_completed', 'completed', 2, { kind: 'completed' }),
  ],
});

const heldTask = (id: string, branch: string) =>
  Task.openedInChat({
    line: LINE,
    at: SHIP,
    title: TaskTitle.of('Show video icons'),
    description: null,
    branch: Branch.of(branch),
    rank: TaskRank.of('i'),
    by: LEON,
    members: TeamMembers.of([LEON]),
    chat: CHAT,
    hold: HoldId.of(`hold_${id}`),
    now: NOW,
    newId: () => id,
  });

const deleted = new ChatDeleted(
  CHAT,
  WorkspaceId.of('ws_1'),
  LEON,
  TeamId.of('team_1'),
  null,
);

const using = (held: readonly Task[], line: LineMap | null = LINE) => {
  const stored = new Map(held.map((each) => [each.id.value, each]));
  const handler = new ReleaseTasksOfDeletedChat(
    {
      heldForChat: async () => [...stored.values()],
      find: async (id: TaskId) => stored.get(id.value) ?? null,
      save: async (task: Task) => {
        stored.set(task.id.value, task);
      },
    } as unknown as TaskRepository,
    { findByStation: async () => line },
    {
      inTransaction: (work: () => Promise<unknown>) => work(),
    } as TransactionPort,
    { now: () => LATER } as ClockPort,
  );

  return { handler, stored: (id: string) => stored.get(id) };
};

describe('ReleaseTasksOfDeletedChat', () => {
  it('hands each task the deleted chat held back to the line', async () => {
    const { handler, stored } = using([
      heldTask('task_1', 'feat/video-icons'),
      heldTask('task_2', 'feat/audio-icons'),
    ]);

    await handler.on(deleted);

    expect(stored('task_1')?.openHold).toBeNull();
    expect(stored('task_2')?.openHold).toBeNull();
    expect(stored('task_1')?.wantsRun(LINE)).toBe(true);
  });

  it('leaves a task whose line is gone as it is', async () => {
    const task = heldTask('task_1', 'feat/video-icons');
    const { handler, stored } = using([task], null);

    await handler.on(deleted);

    expect(stored('task_1')).toBe(task);
  });
});
