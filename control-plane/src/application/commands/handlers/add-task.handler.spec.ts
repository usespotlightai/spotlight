import { AddTaskCommand } from '@application/commands/add-task.command';
import { AddTaskHandler } from '@application/commands/handlers/add-task.handler';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { AttachmentStorePort } from '@application/ports/attachment-store.port';
import type { ClockPort } from '@application/ports/clock.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { PersonReaderPort } from '@application/ports/person-reader.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { TaskBriefing } from '@application/rendering/task-briefing';
import { FilesAtHand } from '@application/services/files-at-hand.service';
import { RaiseTask } from '@application/services/raise-task';
import type { TaskDispatching } from '@application/services/task-dispatch';
import { Line } from '@domain/aggregates/line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { Attachment } from '@domain/value-objects/attachment.vo';
import type { AttachmentId } from '@domain/value-objects/attachment-id.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { LineId } from '@domain/value-objects/line-id.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LineName } from '@domain/value-objects/line-name.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ids: IdGeneratorPort = { generate: () => 'task_1' };

const raised = new Date('2026-08-27T09:15:00.000Z');
const clock: ClockPort = { now: () => raised, sleep: async () => {} };

const line = () =>
  Line.of({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
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
        color: StationColor.of('#93a1b5'),
        harness: HarnessId.of('dev'),
        agentPrompt: AgentPrompt.of('## Role'),
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

const dispatched: { harness: string; priority: number; brief: string }[] = [];

const dispatch = (runId: string | null = 'run_1'): TaskDispatching => ({
  dispatch: async ({ task, line }) => {
    const station = line.stationAt(task.stationId);

    if (!station?.harness) {
      return null;
    }
    dispatched.push({
      harness: station.harness.value,
      priority: station.position,
      brief: TaskBriefing.brief({ task, line, skills: [], listedIn: null }),
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
    standingAt: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
    holding: vi.fn(async () => null),
    countsAt: vi.fn(async () => new Map()),
  }) satisfies TaskRepository;

const transaction: TransactionPort = { run: (work) => work() };

const lines = (found: Line | null = line()) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => found),
    holding: vi.fn(async () => found),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => []),
    withRole: vi.fn(async () => null),
  }) satisfies LineRepository;

const files = new FilesAtHand({ find: vi.fn(async () => null) }, {
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

const addTask = (command: AddTaskCommand, board: LineRepository = lines()) =>
  new AddTaskHandler(
    tasks(),
    board,
    ids,
    clock,
    new RaiseTask(tasks(), dispatch(), transaction),
    people,
    files,
  ).execute(command);

beforeEach(() => {
  added = undefined;
  dispatched.length = 0;
});

const raiser = { id: 'user_1', name: 'Ada', image: null };

const people: PersonReaderPort = { find: async () => raiser };

describe('AddTaskHandler', () => {
  it('hands back the task it added', async () => {
    await expect(
      addTask(
        new AddTaskCommand(
          'line_1',
          'station_1',
          'Fix the queue',
          null,
          'user_1',
        ),
      ),
    ).resolves.toEqual({
      id: 'task_1',
      stationId: 'station_1',
      title: 'Fix the queue',
      description: null,
      attachments: [],
      createdAt: raised.toISOString(),
      rank: added?.rank.value,
      running: true,
      awaitingReview: null,
      pullRequest: null,
      raisedBy: raiser,
      assignee: raiser,
      labels: [],
      note: null,
    });
  });

  it('takes the workspace from the line, not from the caller', async () => {
    await addTask(
      new AddTaskCommand(
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
        'line_1',
        'station_1',
        'Fix it',
        '## Steps\n\nGo.',
        'user_1',
      ),
    );

    expect(added?.description?.value).toBe('## Steps\n\nGo.');
  });

  it('attaches what the raiser uploaded, and tells the agent where it is', async () => {
    await addTask(
      new AddTaskCommand(
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
  });

  it('hands the task to a runner as soon as it is raised', async () => {
    await addTask(
      new AddTaskCommand(
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

  it('holds work back at a station no runners answer for', async () => {
    await addTask(
      new AddTaskCommand(
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

  it('refuses a station the line does not hold', async () => {
    await expect(
      addTask(
        new AddTaskCommand(
          'line_1',
          'station_missing',
          'Fix it',
          null,
          'user_1',
        ),
      ),
    ).rejects.toThrow(UseCaseFault);
  });

  it('refuses a line that does not exist', async () => {
    await expect(
      addTask(
        new AddTaskCommand(
          'line_missing',
          'station_1',
          'Fix it',
          null,
          'user_1',
        ),
        lines(null),
      ),
    ).rejects.toThrow(UseCaseFault);
  });

  it('refuses a task with no title', async () => {
    await expect(
      addTask(new AddTaskCommand('line_1', 'station_1', '   ', null, 'user_1')),
    ).rejects.toThrow(UseCaseFault);
  });
});
