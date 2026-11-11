import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { AddTaskCommand } from '@work/application/commands/add-task.command';
import { AddTaskHandler } from '@work/application/commands/handlers/add-task.handler';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { TaskBriefing } from '@work/application/rendering/task-briefing';
import { CreateTask } from '@work/application/services/create-task';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { FilesLoader } from '@work/application/services/files-loader.service';
import { LineLoader } from '@work/application/services/line-loader.service';
import { workAccessSeeing } from '@work/application/services/work-access.fake-spec';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { TeamMembershipRequiredError } from '@work/domain/exceptions/team-membership-required.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ids: IdGeneratorPort = { generate: () => 'task_1' };

const created = new Date('2026-08-27T09:15:00.000Z');
const clock: ClockPort = { now: () => created, sleep: async () => {} };

const line = () =>
  lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    stations: [
      stationOf({
        id: StationId.of('station_0'),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: '#a3a8b0',
        kind: 'backlog',
      }),
      stationOf({
        id: StationId.of('station_1'),
        key: StationKey.of('triage'),
        name: StationName.of('Triage'),
        position: 1,
        color: '#93a1b5',
        harness: HarnessId.of('dev'),
        agentPrompt: '## Role',
      }),
      stationOf({
        id: StationId.of('station_2'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 2,
        color: '#a3a8b0',
        kind: 'completed',
      }),
    ],
  });

const dispatched: { harness: string; priority: number; brief: string }[] = [];

const dispatch = (runId: string | null = 'run_1'): TaskDispatching => ({
  runIdFor: async ({ task, line }) => {
    const station = line.stationAt(task.stationId);

    if (!station?.harness) {
      return null;
    }
    dispatched.push({
      harness: station.harness.value,
      priority: station.position,
      brief: TaskBriefing.brief({
        task: task.briefed,
        line,
        skills: [],
        listedIn: null,
        memories: [],
        memoryFolder: null,
        tools: [],
      }),
    });
    return runId === null ? null : RunId.of(runId);
  },
});

let added: Task | undefined;

const tasks = () =>
  ({
    add: vi.fn(async (task: Task) => {
      added = task;
    }),
    save: vi.fn(),
    find: vi.fn(async () => null),
    remove: vi.fn(),
    placementsAt: vi.fn(async () => []),
    findByCorrelation: vi.fn(async () => []),
    holdingMark: vi.fn(async () => []),
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
    withTurnAnsweredBetween: vi.fn(async () => []),
    awaitingConnection: vi.fn(async () => []),
  }) satisfies TaskRepository & TaskPlacementsPort;

const access = (teamId = 'team_1') =>
  workAccessSeeing((requested) => requested.value === teamId);

const transaction: TransactionPort = { inTransaction: (work) => work() };

const lines = (found: LineMap | null = line()) =>
  ({
    find: vi.fn(async () => found),
    findByStation: vi.fn(async () => found),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => []),
    candidate: vi.fn(),
  }) satisfies LineMapsPort;

const store = {
  grant: vi.fn(),
  received: vi.fn(async (_at, ids: readonly AttachmentId[]) =>
    ids.map((id) =>
      Attachment.of({
        id: id.value,
        name: 'queue.png',
        contentType: 'image/png',
        size: 4096,
      }),
    ),
  ),
  save: vi.fn(),
  stored: vi.fn(async () => true),
  taken: vi.fn(),
  copy: vi.fn(),
  link: vi.fn(),
  linkPending: vi.fn(),
  open: vi.fn(),
} satisfies AttachmentStorePort;

const files = new FilesLoader(store);

const addTask = (
  command: AddTaskCommand,
  board: LineMapsPort = lines(),
  seen = access(),
) =>
  new AddTaskHandler(
    tasks(),
    new LineLoader(seen, board),
    ids,
    clock,
    new CreateTask(tasks(), dispatch(), transaction, files),
    files,
  ).execute(command);

beforeEach(() => {
  added = undefined;
  dispatched.length = 0;
});

describe('AddTaskHandler', () => {
  it('hands back the id of the task it added', async () => {
    await expect(
      addTask(
        new AddTaskCommand(
          'team_1',
          'line_1',
          'station_1',
          'Fix the queue',
          null,
          'user_1',
        ),
      ),
    ).resolves.toBe('task_1');

    expect(added?.id.value).toBe('task_1');
    expect(added?.title.value).toBe('Fix the queue');
    expect(added?.createdAt).toEqual(created);
    expect(added?.assignee?.value).toBe('user_1');
  });

  it('takes the workspace from the line, not from the caller', async () => {
    await addTask(
      new AddTaskCommand(
        'team_1',
        'line_1',
        'station_1',
        'Fix the queue',
        null,
        'user_1',
      ),
    );

    expect(added?.workspaceId).toEqual(WorkspaceId.of('ws_1'));
  });

  it('keeps a description written in markdown', async () => {
    await addTask(
      new AddTaskCommand(
        'team_1',
        'line_1',
        'station_1',
        'Fix it',
        '## Steps\n\nGo.',
        'user_1',
      ),
    );

    expect(added?.description?.value).toBe('## Steps\n\nGo.');
  });

  it('attaches what the creator uploaded, and tells the agent where it is', async () => {
    await addTask(
      new AddTaskCommand(
        'team_1',
        'line_1',
        'station_1',
        'Fix the queue',
        null,
        'user_1',
        ['file_1'],
      ),
    );

    expect(added?.attachments.map((each) => each.id.value)).toEqual(['file_1']);
    expect(dispatched[0]?.brief).toContain(
      '- `.spotlight/attachments/file_1/queue.png` (image/png, 4 KB)',
    );
    expect(store.taken).toHaveBeenCalledWith(
      added?.workspaceId,
      added?.attachments,
    );
  });

  it('hands the task to a runner as soon as it is created', async () => {
    await addTask(
      new AddTaskCommand(
        'team_1',
        'line_1',
        'station_1',
        'Fix the queue',
        null,
        'user_1',
      ),
    );

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({ harness: 'dev', priority: 1 });
    expect(dispatched[0]?.brief).toContain('## Role\n\n## Fix the queue');
    expect(added?.currentRunId?.value).toBe('run_1');
  });

  it('keeps work back at a station no runners answer for', async () => {
    await addTask(
      new AddTaskCommand(
        'team_1',
        'line_1',
        'station_0',
        'Think about it',
        null,
        'user_1',
      ),
    );

    expect(dispatched).toEqual([]);
    expect(added?.currentRunId).toBeNull();
  });

  it('rejects a station the line does not have', async () => {
    await expect(
      addTask(
        new AddTaskCommand(
          'team_1',
          'line_1',
          'station_missing',
          'Fix it',
          null,
          'user_1',
        ),
      ),
    ).rejects.toThrow(ApplicationError);
  });

  it('rejects a line that does not exist', async () => {
    await expect(
      addTask(
        new AddTaskCommand(
          'team_1',
          'line_missing',
          'station_1',
          'Fix it',
          null,
          'user_1',
        ),
        lines(null),
      ),
    ).rejects.toThrow(ApplicationError);
  });

  it('refuses a workspace member who sees the team but is not on it, adding nothing', async () => {
    await expect(
      addTask(
        new AddTaskCommand(
          'team_1',
          'line_1',
          'station_1',
          'Fix it',
          null,
          'user_1',
        ),
        lines(),
        workAccessSeeing((requested) => requested.value === 'team_1', {
          onTeam: () => false,
        }),
      ),
    ).rejects.toMatchObject({
      refusal: expect.any(TeamMembershipRequiredError) as unknown,
    });
    expect(added).toBeUndefined();
  });

  it('rejects a task with no title', async () => {
    await expect(
      addTask(
        new AddTaskCommand(
          'team_1',
          'line_1',
          'station_1',
          '   ',
          null,
          'user_1',
        ),
      ),
    ).rejects.toThrow(ApplicationError);
  });
});
