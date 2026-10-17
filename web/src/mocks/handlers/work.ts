import type { RequestHandler } from 'msw';
import type {
  AddTaskRequestDto,
  AssignTaskRequestDto,
  AttachmentResponseDto,
  GrantAttachmentUploadRequestDto,
  MoveTaskRequestDto,
  SendMessageRequestDto,
  TaskResponseDto,
  TeamTracesResponseDto,
} from '@/lib/api';
import { placed } from '@/lib/task';
import { api, json, noContent, notFound, problem } from '@/mocks/http';
import { perWorld, world } from '@/mocks/world';
import { SAM } from '@/mocks/world/people';
import { runNetworkOf } from '@/mocks/world/run-network';
import {
  addMessage,
  changeStacksOf,
  conversationOf,
  findTask,
  latestChangeStackOf,
  locateRun,
  placeStation,
  readableTask,
  runStationIn,
  taskTraceOf,
  teamRunsOf,
  teamTracesOf,
} from '@/mocks/world/work';
import { runMemoriesOf } from '@/mocks/world/work-memories';

const UPLOAD_PATH = '/attachment-uploads/:attachmentId';

const uploads = perWorld((): Record<string, AttachmentResponseDto> => ({}));

let idCount = 0;

const nextId = (prefix: string) => {
  idCount += 1;
  return `${prefix}_${Date.now().toString(36)}${idCount}`;
};

const attachmentsOf = (ids: readonly string[] = []) =>
  ids
    .map((id) => uploads()[id])
    .filter((each): each is AttachmentResponseDto => each !== undefined);

const replaceTask = (teamId: string, next: TaskResponseDto) => {
  const tasks = world().tasks[teamId] ?? [];
  world().tasks[teamId] = tasks.map((each) =>
    each.id === next.id ? next : each,
  );
};

const queueRunAt = (teamId: string, taskId: string, stationId: string) => {
  const placedAt = placeStation(teamId, stationId);

  if (placedAt?.station.kind !== 'work') {
    return;
  }

  const now = new Date().toISOString();
  world().runs[taskId] = [
    {
      id: nextId('run'),
      state: 'queued',
      attempt: 1,
      exitCode: null,
      startedAt: now,
      updatedAt: now,
      harness: placedAt.station.harness ?? 'claude-code',
      image: null,
      station: runStationIn(teamId, stationId),
      review: null,
    },
    ...(world().runs[taskId] ?? []),
  ];
};

const RANGES = new Set<string>([
  '30m',
  '1h',
  '6h',
  '1d',
  '3d',
  '7d',
  '14d',
  '30d',
  '90d',
]);

const rangeFrom = (url: string): TeamTracesResponseDto['range'] => {
  const asked = new URL(url).searchParams.get('range') ?? '30d';
  return (RANGES.has(asked) ? asked : '30d') as TeamTracesResponseDto['range'];
};

export const workHandlers: RequestHandler[] = [
  api.post(
    '/teams/:teamId/lines/:lineId/stations/:stationId/tasks',
    async ({ params, request }) => {
      const teamId = String(params.teamId);
      const stationId = String(params.stationId);

      if (!placeStation(teamId, stationId)) {
        return notFound();
      }

      const body = (await request.json()) as AddTaskRequestDto;
      const task: TaskResponseDto = {
        id: nextId('task'),
        stationId,
        revision: 0,
        title: body.title,
        description: body.description ?? null,
        attachments: attachmentsOf(body.attachments),
        createdAt: new Date().toISOString(),
        running: false,
        awaitingReview: null,
        pullRequest: null,
        raisedBy: SAM,
        assignee: null,
        note: null,
      };

      world().tasks[teamId] = [...(world().tasks[teamId] ?? []), task];
      queueRunAt(teamId, task.id, stationId);

      return json(task, 201);
    },
  ),

  api.post(
    '/teams/:teamId/lines/:lineId/tasks/:taskId/move',
    async ({ params, request }) => {
      const teamId = String(params.teamId);
      const task = findTask(teamId, String(params.taskId));
      const body = (await request.json()) as MoveTaskRequestDto;

      if (!task || !placeStation(teamId, body.stationId)) {
        return notFound();
      }
      if (body.revision !== task.revision) {
        return problem(
          409,
          'Sorry, someone moved this task first. Please try again.',
        );
      }

      const moved = { ...task, revision: task.revision + 1 };
      world().tasks[teamId] = placed(
        (world().tasks[teamId] ?? []).map((each) =>
          each.id === task.id ? moved : each,
        ),
        task.id,
        body.stationId,
        body.afterTaskId ?? null,
      );

      if (task.stationId !== body.stationId) {
        queueRunAt(teamId, task.id, body.stationId);
      }

      return json(findTask(teamId, task.id));
    },
  ),

  api.delete('/teams/:teamId/tasks/:taskId', ({ params }) => {
    const teamId = String(params.teamId);
    const taskId = String(params.taskId);

    if (!findTask(teamId, taskId)) {
      return notFound();
    }

    world().tasks[teamId] = (world().tasks[teamId] ?? []).filter(
      (each) => each.id !== taskId,
    );
    delete world().runs[taskId];

    return noContent();
  }),

  api.put(
    '/teams/:teamId/tasks/:taskId/assignee',
    async ({ params, request }) => {
      const teamId = String(params.teamId);
      const task = findTask(teamId, String(params.taskId));
      const { assigneeId } = (await request.json()) as AssignTaskRequestDto;
      const member = (world().members[teamId] ?? []).find(
        (each) => each.id === assigneeId,
      );

      if (!task || (assigneeId !== null && !member)) {
        return notFound();
      }

      const assigned: TaskResponseDto = {
        ...task,
        assignee: member
          ? { id: member.id, name: member.name, image: member.image }
          : null,
      };
      replaceTask(teamId, assigned);

      return json(assigned);
    },
  ),

  api.get('/teams/:teamId/runs', ({ params }) =>
    json(teamRunsOf(String(params.teamId))),
  ),

  api.get('/teams/:teamId/runs/:runId/conversation', ({ params }) => {
    const located = locateRun(String(params.teamId), String(params.runId));
    return located ? json(conversationOf(located)) : notFound();
  }),

  api.get('/teams/:teamId/runs/:runId/change-stacks', ({ params }) => {
    const located = locateRun(String(params.teamId), String(params.runId));
    return located
      ? json({ stacks: changeStacksOf(located.run.id) })
      : notFound();
  }),

  api.get('/teams/:teamId/runs/:runId/memories', ({ params }) => {
    const located = locateRun(String(params.teamId), String(params.runId));
    return located ? json(runMemoriesOf(located.run.id)) : notFound();
  }),

  api.post(
    '/teams/:teamId/runs/:runId/messages',
    async ({ params, request }) => {
      const located = locateRun(String(params.teamId), String(params.runId));

      if (!located) {
        return notFound();
      }

      const body = (await request.json()) as SendMessageRequestDto;
      addMessage(located, body.body, attachmentsOf(body.attachments));

      return noContent();
    },
  ),

  api.post('/teams/:teamId/runs/:runId/stop', ({ params }) => {
    const teamId = String(params.teamId);
    const located = locateRun(teamId, String(params.runId));

    if (!located) {
      return notFound();
    }

    const now = new Date().toISOString();
    world().runs[located.task.id] = (world().runs[located.task.id] ?? []).map(
      (each) =>
        each.id === located.run.id
          ? { ...each, state: 'failed', exitCode: null, updatedAt: now }
          : each,
    );
    replaceTask(teamId, { ...located.task, running: false });

    return noContent();
  }),

  api.get('/teams/:teamId/tasks/:taskId/change-stack', ({ params }) => {
    const task = readableTask(String(params.teamId), String(params.taskId));
    return task ? json({ latest: latestChangeStackOf(task.id) }) : notFound();
  }),

  api.get('/teams/:teamId/tasks/:taskId/trace', ({ params }) => {
    const task = readableTask(String(params.teamId), String(params.taskId));
    return task ? json(taskTraceOf(task.id)) : notFound();
  }),

  api.get('/teams/:teamId/runs/:runId/network', ({ params }) => {
    const network = runNetworkOf(String(params.runId));
    return network ? json(network) : notFound();
  }),

  api.get('/teams/:teamId/traces', ({ params, request }) =>
    world().lines[String(params.teamId)]
      ? json(teamTracesOf(String(params.teamId), rangeFrom(request.url)))
      : notFound(),
  ),

  api.post('/workspaces/:slug/attachments', async ({ params, request }) => {
    if (params.slug !== world().workspace.slug) {
      return notFound();
    }

    const body = (await request.json()) as GrantAttachmentUploadRequestDto;
    const id = nextId('attachment');
    const contentType = body.contentType ?? 'application/octet-stream';

    uploads()[id] = { id, name: body.name, contentType, size: body.size };

    return json(
      {
        id,
        url: `/api${UPLOAD_PATH.replace(':attachmentId', id)}`,
        headers: { 'content-type': contentType },
      },
      201,
    );
  }),

  api.put(UPLOAD_PATH, ({ params }) =>
    uploads()[String(params.attachmentId)] ? noContent() : notFound(),
  ),
];
