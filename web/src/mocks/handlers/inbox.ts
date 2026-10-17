import type { RequestHandler } from 'msw';
import type {
  AnswerInboxItemRequestDto,
  ApproveMemoriesRequestDto,
  CodeReviewResponseDto,
  DisputeDecisionRequestDto,
  DraftReviewCommentRequestDto,
  EditReviewCommentRequestDto,
  GradeResponseDto,
  GradeRunRequestDto,
  InboxItemResponseDto,
  MemoryReviewResponseDto,
  ProposedMemoryResponseDto,
  RunScoresResponseDto,
  SubmitReviewRequestDto,
} from '@/lib/api';
import { api, json, noContent, notFound, problem } from '@/mocks/http';
import { taskOfRun, teamOfTask, world } from '@/mocks/world';
import { noDecisions } from '@/mocks/world/inbox-reviews';
import { pastScoresOf } from '@/mocks/world/inbox-scores';
import { inboxStore, nextId } from '@/mocks/world/inbox-store';
import {
  historyRunOf,
  isCoreTask,
  pastTaskOf,
  teamOfPastTask,
} from '@/mocks/world/past-work';
import { SAM } from '@/mocks/world/people';
import { journalsOfTask } from '@/mocks/world/run-stories';

type Params = Record<string, string | readonly string[] | undefined>;

const param = (params: Params, name: string): string =>
  decodeURIComponent(String(params[name]));

const now = () => new Date().toISOString();

const isOurs = (params: Params) =>
  param(params, 'slug') === world().workspace.slug;

const itemOf = (id: string): InboxItemResponseDto | undefined =>
  inboxStore().entries.find(
    (entry): entry is InboxItemResponseDto =>
      entry.kind === 'task' && entry.id === id,
  );

const taskOf = (taskId: string) => {
  const teamId = teamOfTask(taskId);

  return teamId
    ? world().tasks[teamId]?.find((task) => task.id === taskId)
    : undefined;
};

const anyTaskOf = (taskId: string) => taskOf(taskId) ?? pastTaskOf(taskId);

const teamOfAnyTask = (taskId: string) =>
  teamOfTask(taskId) ?? teamOfPastTask(taskId);

const taskOfAnyRun = (runId: string) =>
  taskOfRun(runId) ??
  (historyRunOf(runId) && !isCoreTask(historyRunOf(runId)?.taskId ?? '')
    ? historyRunOf(runId)?.taskId
    : undefined);

const resolveAsides = (form: 'grade' | 'memories', runId: string) => {
  for (const entry of inboxStore().entries) {
    if (
      entry.kind === 'task' &&
      entry.aside?.form === form &&
      entry.aside.about === runId
    ) {
      entry.resolved = true;
      entry.unread = false;
    }
  }
};

const answerReviewOf = (item: InboxItemResponseDto) => {
  const task = taskOf(item.taskId);

  if (task?.awaitingReview?.conversationId === item.id) {
    task.awaitingReview = null;
  }
  for (const run of world().runs[item.taskId] ?? []) {
    if (run.review?.conversationId === item.id) {
      run.review = { ...run.review, state: 'answered' };
    }
  }
};

const answer = (
  item: InboxItemResponseDto,
  said: AnswerInboxItemRequestDto,
) => {
  const pending = item.notes.findLast((note) => note.kind === 'asked');
  const deciding = said.approve !== undefined;

  if (deciding && pending?.approval) {
    pending.approval = {
      ...pending.approval,
      status: said.approve ? 'granted' : 'refused',
      edited: said.approve && said.inputs ? said.inputs : null,
    };
  }

  item.notes.push({
    position: item.notes.length,
    kind: 'answered',
    form: deciding ? 'approval' : 'words',
    voice: 'person',
    station: item.station,
    stationColor: item.stationColor,
    stationPosition: item.stationPosition,
    runId: null,
    body: said.body,
    attachments: [],
    at: now(),
    author: SAM,
    approval: null,
    failure: null,
    connection: null,
  });
  item.askedAt = now();
  item.resolved = true;
  item.unread = false;
  answerReviewOf(item);
};

const conversationHandlers = [
  api.get('/workspaces/:slug/inbox', ({ params }) =>
    isOurs(params)
      ? json(
          [...inboxStore().entries].sort(
            (one, other) => Date.parse(other.askedAt) - Date.parse(one.askedAt),
          ),
        )
      : notFound(),
  ),

  api.post(
    '/workspaces/:slug/inbox/:itemId/answer',
    async ({ params, request }) => {
      const item = itemOf(param(params, 'itemId'));

      if (!isOurs(params) || !item || item.aside) {
        return notFound();
      }
      if (item.resolved) {
        return problem(409, 'Sorry, this was already answered.');
      }

      const said = (await request.json()) as AnswerInboxItemRequestDto;
      const owesDecision =
        item.notes.findLast((note) => note.kind === 'asked')?.form ===
        'approval';

      if (said.approve !== undefined && !owesDecision) {
        return problem(400, 'Nothing here waits for an approval.');
      }

      answer(item, said);

      return noContent();
    },
  ),

  api.post('/workspaces/:slug/inbox/:itemId/read', ({ params }) => {
    const item = itemOf(param(params, 'itemId'));

    if (!isOurs(params) || !item || item.aside) {
      return notFound();
    }
    item.unread = false;

    return noContent();
  }),

  api.post('/workspaces/:slug/inbox/asides/:asideId/read', ({ params }) => {
    const item = itemOf(param(params, 'asideId'));

    if (!isOurs(params) || !item?.aside) {
      return notFound();
    }
    item.unread = false;

    return noContent();
  }),

  api.post(
    '/workspaces/:slug/inbox/notices/:noticeId/resolve',
    ({ params }) => {
      const notice = inboxStore().entries.find(
        (entry) =>
          entry.kind === 'notice' && entry.id === param(params, 'noticeId'),
      );

      if (!isOurs(params) || !notice) {
        return notFound();
      }
      notice.resolved = true;
      notice.unread = false;

      return noContent();
    },
  ),

  api.get('/workspaces/:slug/inbox/tasks/:taskId/journal', ({ params }) => {
    const taskId = param(params, 'taskId');

    const inInbox = inboxStore().entries.some(
      (entry) => entry.kind === 'task' && entry.taskId === taskId,
    );

    return isOurs(params) && (teamOfAnyTask(taskId) || inInbox)
      ? json(journalsOfTask(taskId))
      : notFound();
  }),
];

const alertHandlers = [
  api.get('/teams/:teamId/insights/alerts/:alertId', ({ params }) => {
    const alert = inboxStore().alerts[param(params, 'alertId')];
    const onTeam =
      alert && teamOfAnyTask(alert.taskId) === param(params, 'teamId');

    return onTeam ? json(alert) : notFound();
  }),
];

const gradeOf = (
  kind: GradeResponseDto['kind'],
  given: GradeRunRequestDto,
): GradeResponseDto => {
  const base = { by: SAM.id, mine: true, kind, at: now() };

  if (given.claims) {
    const met = given.claims.filter(Boolean).length;
    const share = given.claims.length ? met / given.claims.length : 0;

    return {
      ...base,
      value: share,
      marks: given.claims,
      label: `${Math.round(share * 100)}% of claims met`,
    };
  }
  if (typeof given.value === 'boolean') {
    return {
      ...base,
      value: given.value ? 1 : 0,
      marks: null,
      label: given.value ? 'yes' : 'no',
    };
  }

  return {
    ...base,
    value: given.value ?? 0,
    marks: null,
    label: `${given.value ?? 0}`,
  };
};

const scoresFor = (runId: string): RunScoresResponseDto | undefined => {
  const store = inboxStore();
  const found = store.scores[runId];
  if (found) {
    return found;
  }
  const run = historyRunOf(runId);
  if (!run || isCoreTask(run.taskId)) {
    return undefined;
  }
  store.scores[runId] = pastScoresOf(run);

  return store.scores[runId];
};

const scoreHandlers = [
  api.get('/teams/:teamId/runs/:runId/scores', ({ params }) => {
    const scores = scoresFor(param(params, 'runId'));

    return scores ? json(scores) : notFound();
  }),

  api.post('/teams/:teamId/runs/:runId/grades', async ({ params, request }) => {
    const runId = param(params, 'runId');
    const scores = scoresFor(runId);

    if (!scores) {
      return notFound();
    }

    const given = (await request.json()) as GradeRunRequestDto;
    scores.grades = [
      gradeOf(scores.kind, given),
      ...scores.grades.filter((grade) => !grade.mine),
    ];
    resolveAsides('grade', runId);

    return json(scores);
  }),
];

const codeReviewOf = (runId: string): CodeReviewResponseDto | undefined => {
  const store = inboxStore();
  const found = store.codeReviews[runId];

  if (found) {
    return found;
  }

  const taskId = taskOfAnyRun(runId);

  if (!taskId) {
    return undefined;
  }

  const made: CodeReviewResponseDto = {
    pullRequest: anyTaskOf(taskId)?.pullRequest ?? null,
    comments: [],
    reviews: [],
  };
  store.codeReviews[runId] = made;

  return made;
};

const draftedComment = (
  review: CodeReviewResponseDto,
  drafted: DraftReviewCommentRequestDto,
) => {
  const answering = drafted.replyTo
    ? review.comments.find((each) => each.id === drafted.replyTo)
    : undefined;

  return {
    id: nextId('comment'),
    path: answering?.path ?? drafted.path ?? '',
    side: answering?.side ?? drafted.side ?? 'new',
    line: answering?.line ?? drafted.line ?? null,
    startLine: answering?.startLine ?? drafted.startLine ?? null,
    body: drafted.body,
    authorName: SAM.name,
    authorLogin: null,
    authorImage: SAM.image,
    yours: true,
    byAgent: false,
    replyTo: answering?.replyTo ?? answering?.id ?? null,
    state: 'draft' as const,
    failure: null,
    url: null,
    createdAt: now(),
    editedAt: null,
  };
};

const reviewHandlers = [
  api.get('/teams/:teamId/runs/:runId/review', ({ params }) => {
    const review = codeReviewOf(param(params, 'runId'));

    return review ? json(review) : notFound();
  }),

  api.post(
    '/teams/:teamId/runs/:runId/review/comments',
    async ({ params, request }) => {
      const review = codeReviewOf(param(params, 'runId'));

      if (!review) {
        return notFound();
      }

      const drafted = (await request.json()) as DraftReviewCommentRequestDto;

      if (!drafted.path && !drafted.replyTo) {
        return problem(400, 'A comment needs a file or a comment to answer.');
      }

      const comment = draftedComment(review, drafted);
      review.comments.push(comment);

      return json({ id: comment.id }, 201);
    },
  ),

  api.patch(
    '/teams/:teamId/runs/:runId/review/comments/:commentId',
    async ({ params, request }) => {
      const comment = codeReviewOf(param(params, 'runId'))?.comments.find(
        (each) => each.id === param(params, 'commentId') && each.yours,
      );

      if (!comment) {
        return notFound();
      }

      const { body } = (await request.json()) as EditReviewCommentRequestDto;
      comment.body = body;
      comment.editedAt = now();

      return noContent();
    },
  ),

  api.delete(
    '/teams/:teamId/runs/:runId/review/comments/:commentId',
    ({ params }) => {
      const review = codeReviewOf(param(params, 'runId'));
      const commentId = param(params, 'commentId');

      if (
        !review?.comments.some((each) => each.id === commentId && each.yours)
      ) {
        return notFound();
      }
      review.comments = review.comments.filter((each) => each.id !== commentId);

      return noContent();
    },
  ),

  api.post('/teams/:teamId/runs/:runId/review', async ({ params, request }) => {
    const review = codeReviewOf(param(params, 'runId'));

    if (!review) {
      return notFound();
    }
    if (!review.pullRequest) {
      return problem(409, 'Sorry, there is no pull request to review yet.');
    }

    const submitted = (await request.json()) as SubmitReviewRequestDto;
    const id = nextId('review');

    for (const comment of review.comments) {
      if (comment.yours && comment.state === 'draft') {
        comment.state = 'posted';
        comment.url = `${review.pullRequest}#discussion_${comment.id}`;
      }
    }
    review.reviews.push({
      id,
      authorName: SAM.name,
      yours: true,
      byAgent: false,
      verdict: submitted.verdict,
      body: submitted.body ?? '',
      state: 'posted',
      failure: null,
      submittedAt: now(),
    });

    return json({ id }, 201);
  }),
];

const decisionsOf = (taskId: string) => {
  const store = inboxStore();

  if (!anyTaskOf(taskId)) {
    return undefined;
  }
  store.decisions[taskId] ??= noDecisions();

  return store.decisions[taskId];
};

const decisionHandlers = [
  api.get('/teams/:teamId/tasks/:taskId/decisions', ({ params }) => {
    const decisions = decisionsOf(param(params, 'taskId'));

    return decisions ? json(decisions) : notFound();
  }),

  api.post(
    '/teams/:teamId/tasks/:taskId/decisions/:decisionId/disputes',
    async ({ params, request }) => {
      const decisions = decisionsOf(param(params, 'taskId'));
      const decision = decisions?.decisions.find(
        (each) => each.id === param(params, 'decisionId'),
      );

      if (!decisions || !decision) {
        return notFound();
      }

      const { path, reason } =
        (await request.json()) as DisputeDecisionRequestDto;
      decision.disputes.push({
        id: nextId('dispute'),
        path,
        by: SAM.id,
        byName: SAM.name,
        reason,
        at: now(),
      });

      return json(decisions, 201);
    },
  ),
];

const memoryReviewOf = (
  taskId: string,
  runId: string,
): MemoryReviewResponseDto | undefined => {
  const store = inboxStore();

  if (taskOfAnyRun(runId) !== taskId) {
    return undefined;
  }
  store.memoryReviews[runId] ??= { taskId, runId, memories: [] };

  return store.memoryReviews[runId];
};

const decide = (
  review: MemoryReviewResponseDto,
  memory: ProposedMemoryResponseDto,
  state: 'approved' | 'rejected',
) => {
  memory.state = state;
  memory.decision = { by: SAM.id, name: SAM.name, at: now() };

  if (review.memories.every((each) => each.state !== 'proposed')) {
    resolveAsides('memories', review.runId);
  }
};

const MEMORIES = '/teams/:teamId/tasks/:taskId/runs/:runId/memories';

const memoryHandlers = [
  api.get(MEMORIES, ({ params }) => {
    const review = memoryReviewOf(
      param(params, 'taskId'),
      param(params, 'runId'),
    );

    return review ? json(review) : notFound();
  }),

  api.post(`${MEMORIES}/approve`, async ({ params, request }) => {
    const review = memoryReviewOf(
      param(params, 'taskId'),
      param(params, 'runId'),
    );

    if (!review) {
      return notFound();
    }

    const { memories } = (await request.json()) as ApproveMemoriesRequestDto;
    const chosen = memories.map((approved) => ({
      approved,
      memory: review.memories.find(
        (each) => each.id === approved.id && each.state === 'proposed',
      ),
    }));

    if (chosen.some(({ memory }) => !memory)) {
      return problem(
        409,
        'Sorry, that memory is no longer waiting for a decision.',
      );
    }
    for (const { approved, memory } of chosen) {
      if (memory) {
        memory.body = approved.body ?? memory.body;
        decide(review, memory, 'approved');
      }
    }

    return json(review);
  }),

  api.post(`${MEMORIES}/:memoryId/reject`, ({ params }) => {
    const review = memoryReviewOf(
      param(params, 'taskId'),
      param(params, 'runId'),
    );
    const memory = review?.memories.find(
      (each) => each.id === param(params, 'memoryId'),
    );

    if (!review || !memory) {
      return notFound();
    }
    if (memory.state !== 'proposed') {
      return problem(
        409,
        'Sorry, that memory is no longer waiting for a decision.',
      );
    }
    decide(review, memory, 'rejected');

    return json(review);
  }),
];

export const inboxHandlers: RequestHandler[] = [
  ...conversationHandlers,
  ...alertHandlers,
  ...scoreHandlers,
  ...reviewHandlers,
  ...decisionHandlers,
  ...memoryHandlers,
];
