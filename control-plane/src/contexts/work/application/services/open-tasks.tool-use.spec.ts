import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type {
  OpenTaskReaderPort,
  OpenTaskReading,
} from '@work/application/ports/open-task-reader.port';
import { OpenTasksToolUse } from '@work/application/services/open-tasks.tool-use';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it, vi } from 'vitest';

const CONTEXT: TaskToolContext = {
  kind: 'task',
  runId: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  taskId: TaskId.of('task_1'),
  stationId: StationId.of('station_triage'),
  requester: null,
};

const delivery = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    stationOf({
      id: StationId.of('station_backlog'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      color: '#a3a8b0',
      kind: 'backlog',
    }),
    stationOf({
      id: StationId.of('station_triage'),
      key: StationKey.of('triage'),
      name: StationName.of('Triage'),
      position: 1,
      color: '#93a1b5',
      kind: 'work',
    }),
    stationOf({
      id: StationId.of('station_spec'),
      key: StationKey.of('spec'),
      name: StationName.of('Spec'),
      position: 2,
      color: '#5c66d9',
      kind: 'work',
    }),
    stationOf({
      id: StationId.of('station_completed'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 3,
      color: '#a3a8b0',
      kind: 'completed',
    }),
  ],
});

const reading = (
  id: string,
  stationId: string,
  more: Partial<OpenTaskReading> = {},
): OpenTaskReading => ({
  id: TaskId.of(id),
  title: TaskTitle.of(`Task ${id}`),
  stationId: StationId.of(stationId),
  createdAt: new Date('2026-11-14T11:35:00.000Z'),
  description: null,
  lastNote: null,
  ...more,
});

const using = (
  line: typeof delivery | null,
  found: readonly OpenTaskReading[],
) => {
  const lines = {
    findByStation: vi.fn(async () => line),
  } as unknown as LineMapsPort;
  const tasks = {
    newest: vi.fn<OpenTaskReaderPort['newest']>(async () => found),
  } satisfies OpenTaskReaderPort;

  return { tasks, tool: new OpenTasksToolUse(lines, tasks) };
};

type Answer = {
  readonly tasks: readonly {
    readonly description: string | null;
    readonly lastNote: string | null;
  }[];
  readonly more: boolean;
};

describe('OpenTasksToolUse', () => {
  it('is the open-tasks tool', () => {
    expect(using(delivery, []).tool.tool.value).toBe('open-tasks');
  });

  it('lists the newest other open tasks on the line of the task', async () => {
    const { tool, tasks } = using(delivery, [
      reading('task_2', 'station_spec', {
        description: 'The Sentry alert fired.',
        lastNote: 'Too many connections.',
      }),
    ]);

    expect(await tool.call(CONTEXT)).toEqual({
      tasks: [
        {
          id: 'task_2',
          title: 'Task task_2',
          station: 'spec',
          createdAt: '2026-11-14T11:35:00.000Z',
          description: 'The Sentry alert fired.',
          lastNote: 'Too many connections.',
        },
      ],
      more: false,
    });
    expect(tasks.newest).toHaveBeenCalledWith(
      LineId.of('line_1'),
      TaskId.of('task_1'),
      51,
    );
  });

  it('gives the start of a long description and last note', async () => {
    const { tool } = using(delivery, [
      reading('task_2', 'station_spec', {
        description: 'x'.repeat(700),
        lastNote: 'y'.repeat(601),
      }),
    ]);

    const [answered] = ((await tool.call(CONTEXT)) as Answer).tasks;

    expect(answered?.description).toBe(`${'x'.repeat(600)}…`);
    expect(answered?.lastNote).toBe(`${'y'.repeat(600)}…`);
  });

  it('gives no description where it is only blank space', async () => {
    const { tool } = using(delivery, [
      reading('task_2', 'station_spec', { description: ' \n ' }),
    ]);

    const [answered] = ((await tool.call(CONTEXT)) as Answer).tasks;

    expect(answered?.description).toBeNull();
  });

  it('lists at most 50 tasks and says that there are more', async () => {
    const { tool } = using(
      delivery,
      Array.from({ length: 51 }, (_, at) =>
        reading(`task_${at + 2}`, 'station_spec'),
      ),
    );

    const answer = (await tool.call(CONTEXT)) as Answer;

    expect(answer.tasks).toHaveLength(50);
    expect(answer.more).toBe(true);
  });

  it('leaves out a task whose station the line no longer has', async () => {
    const { tool } = using(delivery, [
      reading('task_2', 'station_removed'),
      reading('task_3', 'station_spec'),
    ]);

    const answer = (await tool.call(CONTEXT)) as {
      tasks: readonly { id: string }[];
    };

    expect(answer.tasks.map((each) => each.id)).toEqual(['task_3']);
  });

  it('fails when the station of the task is on no line', async () => {
    await expect(using(null, []).tool.call(CONTEXT)).rejects.toBeInstanceOf(
      UnknownStationError,
    );
  });
});
