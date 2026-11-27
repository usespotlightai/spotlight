import type { RequestHandler } from 'msw';

import type {
  AddTaskRequestDto,
  AnswerQuestionRequestDto,
  AssignTaskRequestDto,
  AttachmentResponseDto,
  ChangeStackResponseDto,
  GrantAttachmentUploadRequestDto,
  ResumeLineRequestDto,
  MoveTaskRequestDto,
  PublicChangeStackResponseDto,
  SendMessageRequestDto,
  TaskResponseDto,
} from '@/lib/api';
import { placed } from '@/lib/task';
import { api, json, noContent, notFound, problem } from '@/mocks/http';
import { pageOf } from '@/mocks/paging';
import { perWorld, world } from '@/mocks/world';
import { notesBetween } from '@/mocks/world/folded-visits';
import { inboxStore } from '@/mocks/world/inbox-store';
import { SAM } from '@/mocks/world/people';
import { runNetworkOf } from '@/mocks/world/run-network';
import { reviewAnswered } from '@/mocks/world/waiting-for-you';
import {
  addMessage,
  answerStackQuestion,
  changeStacksOf,
  conversationOf,
  findTask,
  latestChangeStackOf,
  locateRun,
  placeStation,
  readableTask,
  runStationIn,
  seenAgain,
  taskChangeStacksOf,
  taskTraceOf,
  teamRunsOf,
} from '@/mocks/world/work';
import { runMemoriesOf } from '@/mocks/world/work-memories';

const publicStackOf = ({
  id,
  repository,
  state,
  files,
  cohorts,
  removed,
}: ChangeStackResponseDto): PublicChangeStackResponseDto => ({
  id,
  repository: repository ?? 'acme/app',
  state,
  files,
  removed,
  cohorts: cohorts.map((cohort) => ({
    ...cohort,
    layers: cohort.layers.map((layer) => ({
      ...layer,
      questions: layer.questions.map(({ id, question, hunks }) => ({
        id,
        question,
        hunks,
      })),
    })),
  })),
});

const publicStacksResponse = (stacks: readonly ChangeStackResponseDto[]) =>
  stacks.length > 0 ? json({ stacks: stacks.map(publicStackOf) }) : notFound();

const UPLOAD_PATH = '/attachment-uploads/:attachmentId';

const uploads = perWorld(
  (): Partial<Record<string, AttachmentResponseDto>> => ({}),
);

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

const queueRunAt = (
  teamId: string,
  taskId: string,
  stationId: string,
  driver: 'line' | 'person' = 'line',
) => {
  const placedAt = placeStation(teamId, stationId);

  if (placedAt?.station.kind !== 'work') {
    return;
  }

  const now = new Date().toISOString();
  world().runs[taskId] = [
    {
      id: nextId('run'),
      driver,
      state: 'queued',
      progress: 'queued',
      attempt: 1,
      exitCode: null,
      startedAt: now,
      updatedAt: now,
      harness: placedAt.station.harness ?? 'claude-code',
      image: null,
      ranOn: null,
      waiting: null,
      station: runStationIn(teamId, stationId),
      review: null,
      waitingForYou: false,
      yourMessage: 'message',
      stoppableByYou: false,
    },
    ...(world().runs[taskId] ?? []),
  ];
};

const holdOnMessage = ({
  teamId,
  task,
}: {
  teamId: string;
  task: TaskResponseDto;
}) => {
  queueRunAt(teamId, task.id, task.stationId, 'person');
  replaceTask(teamId, {
    ...task,
    assignee: SAM,
    hold: {
      by: SAM,
      startedAt: new Date().toISOString(),
      runId: world().runs[task.id]?.[0]?.id ?? null,
      heldMoveTo: null,
      chatId: null,
      viewerDrives: true,
      viewerEnds: true,
    },
  });
};

const reopenOnMessage = ({
  teamId,
  task,
}: {
  teamId: string;
  task: TaskResponseDto;
}) => {
  replaceTask(teamId, { ...task, finished: false });
  if ((placeStation(teamId, task.stationId)?.station.harness ?? '') !== '') {
    queueRunAt(teamId, task.id, task.stationId);
  }
};

const NOT_ON_THE_TEAM = 'Workspace admins who are not on the team cannot.';

const refusalOf = (
  task: TaskResponseDto,
  yourMessage: TaskResponseDto['yourMessage'],
) => {
  const refusals: Partial<
    Record<TaskResponseDto['yourMessage'], [number, string]>
  > = {
    'moved-on': [409, `Task ${task.id} has moved on from that station.`],
    'awaits-another': task.assignee
      ? [409, `Task ${task.id} is assigned to another person.`]
      : [
          403,
          `Task ${task.id} waits for its team. The first answer assigns the task, so only a member of the team can answer it. ${NOT_ON_THE_TEAM}`,
        ],
    'not-acting': [
      403,
      'You are not a member of this team. Only team members and workspace admins can change its tasks.',
    ],
    'not-on-team': [
      403,
      `Task ${task.id} goes on hold when you message it. A hold assigns the task, so only a member of the team can message it. ${NOT_ON_THE_TEAM}`,
    ],
  };
  const refused = refusals[yourMessage];

  return refused ? problem(...refused) : null;
};

const onMessage = (
  located: { teamId: string; task: TaskResponseDto },
  yourMessage: TaskResponseDto['yourMessage'],
) => {
  const asked = located.task.awaitingReview?.conversationId;

  if (yourMessage === 'answer' && asked !== undefined && asked !== '') {
    reviewAnswered(located.task, world().runs[located.task.id] ?? [], asked);
  }
  if (yourMessage === 'holds') {
    holdOnMessage(located);
  }
  if (yourMessage === 'reopens') {
    reopenOnMessage(located);
  }
  seenAgain(located.teamId, located.task.id);
};

export const workHandlers: RequestHandler[] = [
  api.post<AddTaskRequestDto>(
    '/teams/:teamId/lines/:lineId/stations/:stationId/tasks',
    async ({ params, request }) => {
      const teamId = String(params.teamId);
      const stationId = String(params.stationId);

      if (!placeStation(teamId, stationId)) {
        return notFound();
      }

      const body = await request.json();
      const task: TaskResponseDto = {
        id: nextId('task'),
        stationId,
        revision: 0,
        title: body.title,
        description: body.description ?? null,
        attachments: attachmentsOf(body.attachments),
        createdAt: new Date().toISOString(),
        progress: null,
        awaitingReview: null,
        waitingForYou: false,
        yourMessage: 'message',
        finished: false,
        pullRequests: [],
        createdBy: SAM,
        assignee: null,
        note: null,
        source: null,
        hold: null,
        runNotStarted: null,
      };

      world().tasks[teamId] = [...(world().tasks[teamId] ?? []), task];
      queueRunAt(teamId, task.id, stationId);
      seenAgain(teamId, task.id);

      return json(findTask(teamId, task.id), 201);
    },
  ),

  api.post<MoveTaskRequestDto>(
    '/teams/:teamId/lines/:lineId/tasks/:taskId/move',
    async ({ params, request }) => {
      const teamId = String(params.teamId);
      const task = findTask(teamId, String(params.taskId));
      const body = await request.json();

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
      seenAgain(teamId, task.id);

      if (placeStation(teamId, body.stationId)?.station.kind === 'completed') {
        for (const entry of inboxStore().entries) {
          if (entry.kind === 'task' && entry.taskId === task.id) {
            entry.resolved = true;
          }
        }
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

  api.post<ResumeLineRequestDto>(
    '/teams/:teamId/tasks/:taskId/resume',
    async ({ params, request }) => {
      const teamId = String(params.teamId);
      const task = findTask(teamId, String(params.taskId));
      const { next, stationId } = await request.json();

      if (!task?.hold) {
        return notFound();
      }

      const completed = (world().lines[teamId] ?? [])
        .find((line) =>
          line.stations.some((each) => each.id === task.stationId),
        )
        ?.stations.find((each) => each.kind === 'completed');
      const to =
        next === 'move-on' && stationId !== undefined && stationId !== ''
          ? stationId
          : next === 'finish'
            ? (completed?.id ?? task.stationId)
            : task.stationId;
      const resumed: TaskResponseDto = {
        ...task,
        stationId: to,
        finished: next === 'finish',
        hold: null,
        runNotStarted: null,
      };
      replaceTask(teamId, resumed);
      if (next !== 'finish') {
        queueRunAt(teamId, task.id, to);
      }
      seenAgain(teamId, task.id);

      return json(findTask(teamId, task.id));
    },
  ),

  api.put<AssignTaskRequestDto>(
    '/teams/:teamId/tasks/:taskId/assignee',
    async ({ params, request }) => {
      const teamId = String(params.teamId);
      const task = findTask(teamId, String(params.taskId));
      const { assigneeId } = await request.json();
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
      seenAgain(teamId, task.id);

      return json(findTask(teamId, task.id));
    },
  ),

  api.get('/editor-connections', () => json({ connected: false })),

  api.get('/teams/:teamId/runs', ({ params, request }) =>
    json(pageOf(teamRunsOf(String(params.teamId)), request, (run) => run.id)),
  ),

  api.get('/teams/:teamId/runs/:runId', ({ params }) => {
    const run = teamRunsOf(String(params.teamId)).find(
      (each) => each.id === String(params.runId),
    );
    return run ? json(run) : notFound();
  }),

  api.get('/teams/:teamId/tasks/:taskId/notes', ({ params, request }) => {
    const query = new URL(request.url).searchParams;

    return json(
      notesBetween(
        String(params.taskId),
        Number(query.get('from')),
        Number(query.get('to')),
      ),
    );
  }),

  api.get('/teams/:teamId/runs/:runId/notes', ({ params }) => {
    const located = locateRun(String(params.teamId), String(params.runId));
    return located ? json(conversationOf(located)) : notFound();
  }),

  api.get('/teams/:teamId/runs/:runId/change-stacks', ({ params }) => {
    const located = locateRun(String(params.teamId), String(params.runId));
    return located
      ? json({ stacks: changeStacksOf(located.run.id) })
      : notFound();
  }),

  api.get('/teams/:teamId/tasks/:taskId/change-stacks', ({ params }) =>
    findTask(String(params.teamId), String(params.taskId))
      ? json({ stacks: taskChangeStacksOf(String(params.taskId)) })
      : notFound(),
  ),

  api.get('/public/runs/:runId/change-stacks', ({ params }) =>
    publicStacksResponse(changeStacksOf(String(params.runId))),
  ),

  api.get('/public/tasks/:taskId/change-stacks', ({ params }) =>
    publicStacksResponse(taskChangeStacksOf(String(params.taskId))),
  ),

  api.post<AnswerQuestionRequestDto>(
    '/teams/:teamId/change-stacks/:stackId/questions/:questionId/answers',
    async ({ params, request }) => {
      const body = await request.json();

      return json(
        answerStackQuestion(
          String(params.stackId),
          String(params.questionId),
          body.reply,
        ),
        201,
      );
    },
  ),

  api.get('/teams/:teamId/runs/:runId/memories', ({ params }) => {
    const located = locateRun(String(params.teamId), String(params.runId));
    return located ? json(runMemoriesOf(located.run.id)) : notFound();
  }),

  api.post<SendMessageRequestDto>(
    '/teams/:teamId/runs/:runId/messages',
    async ({ params, request }) => {
      const located = locateRun(String(params.teamId), String(params.runId));

      if (!located) {
        return notFound();
      }

      const { yourMessage } = located.run;
      const refused = refusalOf(located.task, yourMessage);

      if (refused) {
        return refused;
      }

      const body = await request.json();
      addMessage(located, body.body, attachmentsOf(body.attachments));
      onMessage(located, yourMessage);

      return noContent();
    },
  ),

  api.post<Partial<SendMessageRequestDto>>(
    '/teams/:teamId/tasks/:taskId/messages',
    async ({ params, request }) => {
      const teamId = String(params.teamId);
      const task = findTask(teamId, String(params.taskId));
      const newest = (world().runs[task?.id ?? ''] ?? []).at(-1);

      if (!task) {
        return notFound();
      }

      const { yourMessage } = task;
      const refused = refusalOf(task, yourMessage);

      if (refused) {
        return refused;
      }

      const body = await request.json();
      if (newest) {
        addMessage(
          { teamId, task, run: newest },
          body.body ?? '',
          attachmentsOf(body.attachments),
        );
      }
      onMessage({ teamId, task }, yourMessage);

      return json(findTask(teamId, task.id));
    },
  ),

  api.post('/teams/:teamId/tasks/:taskId/start', ({ params }) => {
    const task = findTask(String(params.teamId), String(params.taskId));

    if (!task) {
      return notFound();
    }

    return task.runNotStarted
      ? json(task)
      : problem(409, `Task ${task.id} is not waiting for its run to start.`);
  }),

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
          ? {
              ...each,
              state: 'failed',
              progress: null,
              exitCode: null,
              updatedAt: now,
            }
          : each,
    );
    replaceTask(teamId, { ...located.task, progress: null });
    seenAgain(teamId, located.task.id);

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

  api.post<GrantAttachmentUploadRequestDto>(
    '/workspaces/:slug/attachments',
    async ({ params, request }) => {
      if (params.slug !== world().workspace.slug) {
        return notFound();
      }

      const body = await request.json();
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
    },
  ),

  api.put(UPLOAD_PATH, ({ params }) =>
    uploads()[String(params.attachmentId)] ? noContent() : notFound(),
  ),
];
