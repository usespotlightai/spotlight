import { delay, type RequestHandler } from 'msw';

import type {
  AnswerInboxItemRequestDto,
  AnswerDisagreementClaimRequestDto,
  AnswerJudgeDisagreementRequestDto,
  ApproveMemoriesRequestDto,
  CodeReviewResponseDto,
  DisputeDecisionRequestDto,
  DraftReviewCommentRequestDto,
  EditReviewCommentRequestDto,
  JudgeDisagreementResponseDto,
  MemoryReviewResponseDto,
  ProposedMemoryResponseDto,
  SubmitReviewRequestDto,
} from '@/lib/api';
import type { RunScores } from '@/lib/judge';
import { MAX_NOTE } from '@/lib/judge-disagreement';
import { api, json, noContent, notFound, problem } from '@/mocks/http';
import { pageOf } from '@/mocks/paging';
import { taskOfRun, teamOfTask, world } from '@/mocks/world';
import {
  type InboxConversation,
  type InboxEntry,
  shown,
} from '@/mocks/world/inbox';
import { landingsOf, noDecisions } from '@/mocks/world/inbox-reviews';
import { pastScoresOf } from '@/mocks/world/inbox-scores';
import { inboxStore, nextId } from '@/mocks/world/inbox-store';
import {
  historyRunOf,
  isCoreTask,
  pastTaskOf,
  teamOfPastTask,
} from '@/mocks/world/past-work';
import { SAM } from '@/mocks/world/people';
import { journalOfTaskRun, journalRunsOfTask } from '@/mocks/world/run-stories';
import { teamChats } from '@/mocks/world/team-chats';

type Params = Record<string, string | readonly string[] | undefined>;

const param = (params: Params, name: string): string =>
  decodeURIComponent(String(params[name]));

const now = () => new Date().toISOString();

const isOurs = (params: Params) =>
  param(params, 'slug') === world().workspace.slug;

const itemOf = (id: string): InboxConversation | undefined =>
  inboxStore().entries.find(
    (entry): entry is InboxConversation =>
      entry.kind === 'task' && entry.id === id,
  );

const chatOf = (id: string) =>
  inboxStore().entries.find(
    (entry): entry is Extract<InboxEntry, { kind: 'chat' }> =>
      entry.kind === 'chat' && entry.id === id,
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

const journalVisible = (params: Params, taskId: string) =>
  isOurs(params) &&
  Boolean(
    teamOfAnyTask(taskId) ||
    inboxStore().entries.some(
      (entry) => entry.kind === 'task' && entry.taskId === taskId,
    ),
  );

const taskOfAnyRun = (runId: string) =>
  taskOfRun(runId) ??
  (historyRunOf(runId) && !isCoreTask(historyRunOf(runId)?.taskId ?? '')
    ? historyRunOf(runId)?.taskId
    : undefined);

const resolveInboxRequests = (
  form: 'memories' | 'judge-disagreement',
  about: string,
  resolved = true,
) => {
  for (const entry of inboxStore().entries) {
    if (
      entry.kind === 'task' &&
      entry.inboxRequest?.form === form &&
      entry.inboxRequest.about === about
    ) {
      entry.resolved = resolved;
      entry.unread = false;
    }
  }
};

const answerReviewOf = (item: InboxConversation) => {
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

const answer = (item: InboxConversation, reply: AnswerInboxItemRequestDto) => {
  const pending = item.notes.findLast((note) => note.kind === 'asked');
  const deciding = reply.approve !== undefined;

  if (deciding && pending?.approval) {
    pending.approval = {
      ...pending.approval,
      status: reply.approve ? 'approved' : 'dismissed',
      edited: reply.approve && reply.inputs ? reply.inputs : null,
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
    body: reply.body,
    attachments: [],
    at: now(),
    author: SAM,
    coAuthors: [],
    source: null,
    deferredTo: null,
    approval: null,
    failure: null,
    connection: null,
    resumption: null,
    suggestsClosing: false,
  });
  item.askedAt = now();
  item.resolved = true;
  item.unread = false;
  answerReviewOf(item);
};

const notedBySam = (
  item: InboxConversation,
  kind: 'passed' | 'reopened',
  body: string,
) =>
  item.notes.push({
    position: item.notes.length,
    kind,
    form: kind === 'passed' ? 'resolved' : 'words',
    voice: 'person',
    station: item.station,
    stationColor: item.stationColor,
    stationPosition: item.stationPosition,
    runId: null,
    body,
    attachments: [],
    at: now(),
    author: SAM,
    coAuthors: [],
    source: null,
    deferredTo: null,
    approval: null,
    failure: null,
    connection: null,
    resumption: null,
    suggestsClosing: false,
  });

const rowOf = (entry: InboxEntry) => {
  if (entry.kind !== 'task') {
    return shown(entry);
  }

  const { notes, ...row } = shown(entry);

  return { ...row, lastNote: notes[notes.length - 1] ?? null };
};

const newestFirst = (entries: readonly InboxEntry[]) =>
  [...entries].sort(
    (one, other) => Date.parse(other.askedAt) - Date.parse(one.askedAt),
  );

const conversationHandlers = [
  api.get('/workspaces/:slug/inbox', ({ params, request }) => {
    if (!isOurs(params)) {
      return notFound();
    }

    const resolved =
      new URL(request.url).searchParams.get('state') === 'resolved';
    const shown = newestFirst(
      inboxStore().entries.filter((entry) =>
        resolved ? entry.resolved : !entry.resolved || entry.unread,
      ),
    ).map(rowOf);

    return json(
      resolved
        ? pageOf(shown, request, (entry) => `${entry.kind}:${entry.id}`)
        : { items: shown, next: null },
    );
  }),

  api.get('/workspaces/:slug/inbox/:itemId', ({ params }) => {
    const item = itemOf(param(params, 'itemId'));

    return isOurs(params) && item
      ? json({
          ...shown(item),
          lastNote: item.notes[item.notes.length - 1] ?? null,
        })
      : notFound();
  }),

  api.get('/workspaces/:slug/inbox/notices/:noticeId', ({ params }) => {
    const notice = inboxStore().entries.find(
      (entry) =>
        entry.kind === 'notice' && entry.id === param(params, 'noticeId'),
    );

    return isOurs(params) && notice ? json(shown(notice)) : notFound();
  }),

  api.post(
    '/workspaces/:slug/inbox/:itemId/answer',
    async ({ params, request }) => {
      const item = itemOf(param(params, 'itemId'));

      if (!isOurs(params) || !item || item.inboxRequest) {
        return notFound();
      }
      if (item.resolved) {
        return problem(409, 'Sorry, this was already answered.');
      }

      const reply = (await request.json()) as AnswerInboxItemRequestDto;
      const decisionPending =
        item.notes.findLast((note) => note.kind === 'asked')?.form ===
        'approval';

      if (reply.approve !== undefined && !decisionPending) {
        return problem(400, 'Nothing here waits for an approval.');
      }

      answer(item, reply);

      return noContent();
    },
  ),

  api.post('/workspaces/:slug/inbox/:itemId/read', ({ params }) => {
    const item = itemOf(param(params, 'itemId'));

    if (!isOurs(params) || !item || item.inboxRequest) {
      return notFound();
    }
    item.unread = false;

    return noContent();
  }),

  api.post('/workspaces/:slug/inbox/requests/:requestId/read', ({ params }) => {
    const item = itemOf(param(params, 'requestId'));

    if (!isOurs(params) || !item?.inboxRequest) {
      return notFound();
    }
    item.unread = false;

    return noContent();
  }),

  api.post('/workspaces/:slug/inbox/:itemId/resolve', ({ params }) => {
    const item = itemOf(param(params, 'itemId'));

    if (!isOurs(params) || !item || item.inboxRequest) {
      return notFound();
    }
    if (item.resolved) {
      return problem(409, 'Nothing here waits for an answer.');
    }
    notedBySam(item, 'passed', 'Resolved without an answer.');
    item.resolved = true;
    item.unread = false;
    item.runId = null;
    item.progress = null;

    return noContent();
  }),

  api.post('/workspaces/:slug/inbox/:itemId/reopen', ({ params }) => {
    const item = itemOf(param(params, 'itemId'));

    if (!isOurs(params) || !item || item.inboxRequest) {
      return notFound();
    }
    if (item.notes[item.notes.length - 1]?.form !== 'resolved') {
      return problem(409, 'Nobody resolved this conversation.');
    }
    notedBySam(item, 'reopened', 'Reopened.');
    item.resolved = false;

    return noContent();
  }),

  api.post(
    '/workspaces/:slug/inbox/requests/:requestId/reopen',
    ({ params }) => {
      const item = itemOf(param(params, 'requestId'));

      if (!isOurs(params) || !item?.inboxRequest) {
        return notFound();
      }
      item.resolved = false;

      return noContent();
    },
  ),

  api.post('/workspaces/:slug/inbox/chats/:chatId/read', ({ params }) => {
    const chatId = param(params, 'chatId');
    const chat = chatOf(chatId);
    const known = Object.values(teamChats()).some((chats) =>
      chats.some((each) => each.chat.id === chatId),
    );

    if (!isOurs(params) || (!chat && !known)) {
      return notFound();
    }
    if (chat) {
      chat.unread = false;
    }

    return noContent();
  }),

  api.post('/workspaces/:slug/inbox/chats/:chatId/resolve', ({ params }) => {
    const chat = chatOf(param(params, 'chatId'));

    if (!isOurs(params) || !chat) {
      return notFound();
    }
    chat.resolved = true;
    chat.unread = false;

    return noContent();
  }),

  api.post('/workspaces/:slug/inbox/chats/:chatId/reopen', ({ params }) => {
    const chat = chatOf(param(params, 'chatId'));

    if (!isOurs(params) || !chat) {
      return notFound();
    }
    chat.resolved = false;

    return noContent();
  }),

  api.post('/workspaces/:slug/inbox/notices/:noticeId/reopen', ({ params }) => {
    const notice = inboxStore().entries.find(
      (entry) =>
        entry.kind === 'notice' && entry.id === param(params, 'noticeId'),
    );

    if (!isOurs(params) || !notice) {
      return notFound();
    }
    notice.resolved = false;

    return noContent();
  }),

  api.post(
    '/workspaces/:slug/inbox/requests/:requestId/resolve',
    ({ params }) => {
      const item = itemOf(param(params, 'requestId'));

      if (!isOurs(params) || !item?.inboxRequest) {
        return notFound();
      }
      item.resolved = true;
      item.unread = false;

      return noContent();
    },
  ),

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

    return journalVisible(params, taskId)
      ? json(journalRunsOfTask(taskId))
      : notFound();
  }),

  api.get(
    '/workspaces/:slug/inbox/tasks/:taskId/journal/:runId',
    ({ params }) => {
      const taskId = param(params, 'taskId');

      return journalVisible(params, taskId)
        ? json(journalOfTaskRun(taskId, param(params, 'runId')))
        : notFound();
    },
  ),
];

const alertHandlers = [
  api.get('/teams/:teamId/insights/alerts/:alertId', ({ params }) => {
    const alert = inboxStore().alerts[param(params, 'alertId')];
    const onTeam =
      alert && teamOfAnyTask(alert.taskId) === param(params, 'teamId');

    return onTeam ? json(alert) : notFound();
  }),
];

const scoresFor = (runId: string): RunScores | undefined => {
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
  api.get('/teams/:teamId/runs/:runId/scores', async ({ params }) => {
    if (inboxStore().scoresWait) {
      await delay('infinite');
    }

    const scores = scoresFor(param(params, 'runId'));

    return scores ? json(scores) : notFound();
  }),
];

const disagreementOf = (
  params: Params,
): JudgeDisagreementResponseDto | undefined => {
  const disagreement =
    inboxStore().disagreements[param(params, 'disagreementId')];

  return disagreement &&
    teamOfAnyTask(disagreement.taskId) === param(params, 'teamId')
    ? disagreement
    : undefined;
};

const disagreementNotFound = (params: Params) =>
  problem(
    404,
    `Judge disagreement ${param(params, 'disagreementId')} not found.`,
  );

const WHOLE_NUMBER = /^-?\d+$/;

const NOTE_TOO_LONG = `A judge disagreement note must be at most ${MAX_NOTE} characters.`;

const noteTooLong = (note: string | null): boolean =>
  (note?.trim().length ?? 0) > MAX_NOTE;

const notMetRefusalOf = (
  disagreement: JudgeDisagreementResponseDto,
  { shouldHaveFailed, note }: AnswerJudgeDisagreementRequestDto,
): string | null => {
  if (disagreement.direction !== 'judge-passed') {
    return 'A judge disagreement takes what was not met only where the judge passed the run.';
  }
  if (
    shouldHaveFailed !== null &&
    shouldHaveFailed >= disagreement.claims.length
  ) {
    return 'A judge disagreement must name a claim of the judge that looked at the run.';
  }
  if (noteTooLong(note)) {
    return NOTE_TOO_LONG;
  }
  if (
    shouldHaveFailed !== null &&
    !(Number.isInteger(shouldHaveFailed) && shouldHaveFailed >= 0)
  ) {
    return 'A judge disagreement must name the claim that should have failed by its place, from 0.';
  }
  if (shouldHaveFailed === null && !note?.trim()) {
    return 'A judge disagreement where the judge passed the run and no claim covers it, must say what was wrong.';
  }

  return null;
};

const refusedAnswer = (
  disagreement: JudgeDisagreementResponseDto,
): Response | null => {
  if (disagreement.withdrawnAt) {
    return problem(
      409,
      `Judge disagreement ${disagreement.id} is withdrawn. The judge and people agree now, the claims changed, or the run no longer has people’s verdict.`,
    );
  }
  if (disagreement.askedOf && disagreement.askedOf !== SAM.id) {
    return problem(
      403,
      `Judge disagreement ${disagreement.id} asks another person. Only that person can answer it.`,
    );
  }

  return null;
};

const answeredWhole = (disagreement: JudgeDisagreementResponseDto): void => {
  disagreement.state = 'answered';
  resolveInboxRequests('judge-disagreement', disagreement.id);
};

const disagreementHandlers = [
  api.get(
    '/teams/:teamId/judge-disagreements/:disagreementId',
    ({ params }) => {
      const disagreement = disagreementOf(params);

      return disagreement ? json(disagreement) : disagreementNotFound(params);
    },
  ),

  api.post(
    '/teams/:teamId/judge-disagreements/:disagreementId/answer',
    async ({ params, request }) => {
      const disagreement = disagreementOf(params);

      if (!disagreement) {
        return disagreementNotFound(params);
      }

      const refused = refusedAnswer(disagreement);

      if (refused) {
        return refused;
      }
      if (disagreement.notMet) {
        return problem(
          409,
          `Judge disagreement ${disagreement.id} already has an answer.`,
        );
      }

      const answer =
        (await request.json()) as AnswerJudgeDisagreementRequestDto;

      const notMetRefusal = notMetRefusalOf(disagreement, answer);

      if (notMetRefusal) {
        return problem(422, notMetRefusal);
      }

      disagreement.notMet = {
        claim: answer.shouldHaveFailed,
        note: answer.note?.trim() || null,
        answeredBy: SAM.id,
        answeredAt: now(),
      };
      answeredWhole(disagreement);

      return json(disagreement);
    },
  ),

  api.post(
    '/teams/:teamId/judge-disagreements/:disagreementId/claims/:claim/answer',
    async ({ params, request }) => {
      const raw = param(params, 'claim');

      if (!WHOLE_NUMBER.test(raw)) {
        return problem(400, 'Validation failed (numeric string is expected)');
      }

      const claim = Number(raw);

      const disagreement = disagreementOf(params);

      if (!disagreement) {
        return disagreementNotFound(params);
      }

      const answer =
        (await request.json()) as AnswerDisagreementClaimRequestDto;

      if (answer.answer !== 'judge-right' && answer.answer !== 'claim-wrong') {
        return problem(
          422,
          'A judge disagreement must answer a claim with judge-right or claim-wrong.',
        );
      }

      const refused = refusedAnswer(disagreement);

      if (refused) {
        return refused;
      }
      if (!disagreement.disputedClaims.includes(claim)) {
        return problem(
          422,
          `Claim ${claim + 1} is not in dispute in judge disagreement ${disagreement.id}. Answer only a claim the judge and people read differently.`,
        );
      }
      if (disagreement.answers.some((each) => each.claim === claim)) {
        return problem(
          409,
          `Claim ${claim + 1} of judge disagreement ${disagreement.id} already has an answer.`,
        );
      }
      if (noteTooLong(answer.note)) {
        return problem(422, NOTE_TOO_LONG);
      }

      disagreement.answers = [
        ...disagreement.answers,
        {
          claim,
          answer: answer.answer,
          note: answer.note?.trim() || null,
          answeredBy: SAM.id,
          answeredAt: now(),
        },
      ].toSorted((one, other) => one.claim - other.claim);

      if (
        disagreement.disputedClaims.every((each) =>
          disagreement.answers.some((given) => given.claim === each),
        )
      ) {
        answeredWhole(disagreement);
      }

      return json(disagreement);
    },
  ),
];

const codeReviewOf = (taskId: string): CodeReviewResponseDto | undefined => {
  const store = inboxStore();
  const found = store.codeReviews[taskId];

  if (found) {
    return found;
  }

  const task = anyTaskOf(taskId);

  if (!task) {
    return undefined;
  }

  const made: CodeReviewResponseDto = {
    landings: landingsOf(task.pullRequests),
    comments: [],
    reviews: [],
  };
  store.codeReviews[taskId] = made;

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
    repository: answering?.repository ?? drafted.repository ?? null,
    path: answering?.path ?? drafted.path ?? '',
    side: answering?.side ?? drafted.side ?? 'new',
    line: answering?.line ?? drafted.line ?? null,
    startLine: answering?.startLine ?? drafted.startLine ?? null,
    body: drafted.body,
    authorName: SAM.name,
    authorLogin: null,
    authorImage: SAM.image,
    viewerIsAuthor: true,
    isAgentAuthored: false,
    replyTo: answering?.replyTo ?? answering?.id ?? null,
    state: 'draft' as const,
    failure: null,
    url: null,
    createdAt: now(),
    editedAt: null,
  };
};

const reviewHandlers = [
  api.get('/teams/:teamId/tasks/:taskId/review', ({ params }) => {
    const review = codeReviewOf(param(params, 'taskId'));

    return review ? json(review) : notFound();
  }),

  api.post(
    '/teams/:teamId/tasks/:taskId/review/comments',
    async ({ params, request }) => {
      const review = codeReviewOf(param(params, 'taskId'));

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
    '/teams/:teamId/tasks/:taskId/review/comments/:commentId',
    async ({ params, request }) => {
      const comment = codeReviewOf(param(params, 'taskId'))?.comments.find(
        (each) => each.id === param(params, 'commentId') && each.viewerIsAuthor,
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
    '/teams/:teamId/tasks/:taskId/review/comments/:commentId',
    ({ params }) => {
      const review = codeReviewOf(param(params, 'taskId'));
      const commentId = param(params, 'commentId');

      if (
        !review?.comments.some(
          (each) => each.id === commentId && each.viewerIsAuthor,
        )
      ) {
        return notFound();
      }
      review.comments = review.comments.filter((each) => each.id !== commentId);

      return noContent();
    },
  ),

  api.post(
    '/teams/:teamId/tasks/:taskId/review',
    async ({ params, request }) => {
      const review = codeReviewOf(param(params, 'taskId'));

      if (!review) {
        return notFound();
      }
      const submitted = (await request.json()) as SubmitReviewRequestDto;
      const landsOn = review.landings.find(
        (each) => each.repository === (submitted.repository ?? null),
      )?.pullRequest;

      if (!landsOn) {
        return problem(409, 'Sorry, there is no pull request to review yet.');
      }
      const id = nextId('review');

      for (const comment of review.comments) {
        if (
          comment.viewerIsAuthor &&
          comment.state === 'draft' &&
          (!submitted.repository ||
            comment.repository === null ||
            comment.repository === submitted.repository)
        ) {
          comment.state = 'posted';
          comment.url = `${landsOn}#discussion_${comment.id}`;
        }
      }
      review.reviews.push({
        id,
        repository: submitted.repository ?? null,
        authorName: SAM.name,
        viewerIsAuthor: true,
        isAgentAuthored: false,
        verdict: submitted.verdict,
        body: submitted.body ?? '',
        state: 'posted',
        failure: null,
        submittedAt: now(),
      });

      return json({ id }, 201);
    },
  ),
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
    resolveInboxRequests('memories', review.runId);
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

  api.delete(`${MEMORIES}/:memoryId/reject`, ({ params }) => {
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
    if (memory.state !== 'rejected') {
      return problem(409, 'Sorry, only a rejected memory can be restored.');
    }
    memory.state = 'proposed';
    memory.decision = null;
    resolveInboxRequests('memories', review.runId, false);

    return json(review);
  }),
];

export const inboxHandlers: RequestHandler[] = [
  ...conversationHandlers,
  ...alertHandlers,
  ...scoreHandlers,
  ...disagreementHandlers,
  ...reviewHandlers,
  ...decisionHandlers,
  ...memoryHandlers,
];
