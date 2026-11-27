import { AsyncLocalStorage } from 'node:async_hooks';

import type { MemberDirectoryPort } from '@identity/application/ports/member-directory.port';
import type {
  RunFacts,
  RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { firstOf } from '@shared-kernel/domain/item-at';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  type Happened,
  REVIEW_MARK,
} from '@work/application/contracts/happenings.contract';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { ProcessedEventsPort } from '@work/application/ports/processed-events.port';
import type { PullRequestReviewLocksPort } from '@work/application/ports/pull-request-review-locks.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { ChannelChats } from '@work/application/services/channel-chats.service';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { ReactToHappenings } from '@work/application/services/react-to-happenings.service';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Branch } from '@work/domain/value-objects/branch.vo';
import type { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { HeldMark } from '@work/domain/value-objects/held-mark.vo';
import {
  deliveryLineOf,
  repositoryOf,
  reviewLineOf,
  reviewsOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import type {
  ReviewIntake,
  ReviewStart,
} from '@work/domain/value-objects/review-intake.vo';
import { ReviewedPullRequest } from '@work/domain/value-objects/reviewed-pull-request.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAMMATES = {
  membersOf: async () => TeamMembers.of([UserId.of('user_9')]),
};

const NO_RUNS = partial<RunFactsPort>({ of: async () => [] });

const channels = partial<ChannelChats>({
  reached: async () => null,
});

const NOW = new Date('2026-09-18T12:00:00.000Z');
const PULL = 'https://github.com/acme/api/pull/7';
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };
const members: MemberDirectoryPort = {
  byEmail: async () => null,
};
const files = {
  grant: vi.fn(),
  received: vi.fn(async () => []),
  save: vi.fn(),
  stored: vi.fn(async () => true),
  taken: vi.fn(),
  copy: vi.fn(),
  link: vi.fn(),
  linkPending: vi.fn(),
  open: vi.fn(),
} satisfies AttachmentStorePort;
const logger: LoggerPort = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

let made = 0;

const fresh = (prefix: string): string => {
  made += 1;
  return `${prefix}_${made}`;
};

const created = (
  role: LineRole,
  over: { reviews?: ReviewIntake | null } = {},
  repositories: readonly string[] = [],
) =>
  (role.equals(LineRole.REVIEW) ? reviewLineOf : deliveryLineOf)({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    newId: () => fresh('id'),
    harness: HarnessId.of('dev'),
    ...over,
    repositories: repositories.map((each) =>
      repositoryOf(
        // oxlint-disable-next-line typescript/no-non-null-assertion -- the address of a pull request always contains its repository
        PullRequestUrl.of(`https://github.com/${each}/pull/1`).repository!,
      ),
    ),
  });

const reviewing = (
  over: { reviews?: ReviewIntake | null } = {},
  repositories?: string[],
) => created(LineRole.REVIEW, over, repositories);

const requested = (
  trigger: 'opened' | 'mentioned' | 'labelled',
  over: {
    body?: string;
    label?: string;
    draft?: boolean;
    branch?: string | null;
    outside?: boolean;
    pullRequest?: string;
    merged?: boolean;
  } = {},
): Happened => {
  const pullRequest = over.pullRequest ?? PULL;
  const marks = [{ kind: REVIEW_MARK, value: pullRequest }];

  return {
    happening: `github.pull_request.${trigger}`,
    summary: 'A pull request wants a review.',
    answers: trigger === 'mentioned',
    state: 'raised',
    correlationKeys: { branch: null, marks },
    message: nonEmpty(over.body) ? { body: over.body } : null,
    ourOwn: false,
    opens: {
      lineRole: 'review',
      station: null,
      title: 'Retry uploads',
      description: `Review ${pullRequest}`,
      assignEmail: null,
      marks,
      review: {
        trigger,
        label: over.label ?? null,
        pullRequest,
        author: 'octocat',
        outside: over.outside ?? true,
        draft: over.draft ?? false,
        merged: over.merged ?? false,
        branch: over.branch === undefined ? 'fix-uploads' : over.branch,
      },
    },
  };
};

// Holds a lock until the transaction that took it ends, and undoes what a failed transaction marked processed, as the database does.
const locking = () => {
  const held = new Map<string, Promise<void>>();
  interface Scope {
    readonly releases: (() => void)[];
    readonly undos: (() => void)[];
  }
  const scope = new AsyncLocalStorage<Scope>();

  const transaction: TransactionPort = {
    inTransaction: async (work) => {
      const open: Scope = { releases: [], undos: [] };

      try {
        return await scope.run(open, work);
      } catch (error) {
        for (const undo of open.undos) {
          undo();
        }

        throw error;
      } finally {
        for (const release of open.releases) {
          release();
        }
      }
    },
  };

  const lock = async (key: string): Promise<void> => {
    const open = scope.getStore();

    if (!open) {
      throw new Error('A lock needs a transaction.');
    }

    while (held.has(key)) {
      await held.get(key);
    }

    let release = () => {};
    held.set(
      key,
      new Promise<void>((resolve) => {
        release = () => {
          held.delete(key);
          resolve();
        };
      }),
    );
    open.releases.push(release);
  };

  const processedKeys = new Set<string>();
  const processed: ProcessedEventsPort = {
    wasProcessed: async (at, key) => processedKeys.has(`${at.value}/${key}`),
    markProcessed: async (at, key) => {
      const marked = `${at.value}/${key}`;
      const first = !processedKeys.has(marked);
      processedKeys.add(marked);
      if (first) {
        scope.getStore()?.undos.push(() => processedKeys.delete(marked));
      }
      return first;
    },
    purgeBefore: async () => 0,
  };

  return { transaction, lock, processed };
};

const world = (input: {
  lines: readonly LineMap[];
  connected?: readonly string[];
  findByCorrelation?: (correlationKeys: CorrelationKeys) => Task | null;
  owning?: Task | null;
  tasks?: readonly Task[];
  runs?: RunFactsPort;
  failsToSaveOnce?: string;
}) => {
  const workspaceLines = [
    ...input.lines,
    created(LineRole.DELIVERY, {}, input.connected ?? ['acme/api']),
  ];
  const added: Task[] = [];
  const saved: Task[] = [];
  const dispatched: Task[] = [];
  const stored = new Map<string, Task>(
    (input.tasks ?? []).map((each) => [each.id.value, each]),
  );
  const { transaction, lock, processed } = locking();
  let failing = input.failsToSaveOnce ?? null;
  const reviewLocks: PullRequestReviewLocksPort = {
    lock: (at, pullRequest) => lock(`${at.value}:${pullRequest.value}`),
  };
  const holding = (correlationKeys: CorrelationKeys): Task[] =>
    [...stored.values()].filter(
      (each) =>
        (correlationKeys.branch?.equals(each.branch) ?? false) ||
        correlationKeys.marks.some((mark) => each.holdsMark(mark)),
    );

  const tasks = {
    add: vi.fn(async (each: Task) => {
      added.push(each);
      stored.set(each.id.value, each);
    }),
    save: vi.fn(async (each: Task) => {
      if (each.id.value === failing) {
        failing = null;
        throw new Error('The database went away.');
      }

      saved.push(each);
      stored.set(each.id.value, each);
    }),
    find: vi.fn(async () => null),
    remove: vi.fn(),
    placementsAt: vi.fn(async () => []),
    findByCorrelation: vi.fn(
      async (_at: WorkspaceId, correlationKeys: CorrelationKeys) => {
        if (input.findByCorrelation) {
          const found = input.findByCorrelation(correlationKeys);
          return found ? [found] : [];
        }

        return holding(correlationKeys);
      },
    ),
    owningPullRequest: vi.fn(async () => input.owning ?? null),
    reviewingPullRequest: vi.fn(async () => null),
    reviewsOf: vi.fn(async (_at: WorkspaceId, pullRequest: PullRequestUrl) =>
      [...stored.values()].filter(
        (each) => each.reviewedPullRequest?.url.equals(pullRequest) ?? false,
      ),
    ),
    holdingMark: vi.fn(async () => []),
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
    withTurnAnsweredBetween: vi.fn(async () => []),
    awaitingConnection: vi.fn(async () => []),
    startingFrom: vi.fn(async () => []),
    onBranch: vi.fn(async () => null),
  } satisfies TaskRepository & TaskPlacementsPort;

  const lines = {
    find: vi.fn(async () => null),
    findByStation: vi.fn<LineMapsPort['findByStation']>(
      async (stationId) =>
        input.lines.find((line) => line.stationAt(stationId)) ?? null,
    ),
    ofWorkspace: vi.fn(async () => workspaceLines),
    ofTeam: vi.fn(async () => input.lines),
    candidate: vi.fn(),
  } satisfies LineMapsPort;

  const dispatch: TaskDispatching = {
    runIdFor: async ({ task }) => {
      dispatched.push(task);
      return RunId.of('run_1');
    },
  };

  const reactions = new ReactToHappenings(
    tasks,
    tasks,
    lines,
    dispatch,
    transaction,
    clock,
    { generate: () => fresh('task') },
    members,
    files,
    processed,
    logger,
    channels,
    input.runs ?? NO_RUNS,
    TEAMMATES,
    reviewLocks,
  );

  let deliveries = 0;

  return {
    react: (...happenings: Happened[]) => {
      deliveries += 1;

      return reactions.react(
        WorkspaceId.of('ws_1'),
        null,
        happenings,
        `delivery_${deliveries}`,
      );
    },
    redeliver: (delivery: number, ...happenings: Happened[]) =>
      reactions.react(
        WorkspaceId.of('ws_1'),
        null,
        happenings,
        `delivery_${delivery}`,
      ),
    added,
    saved,
    dispatched,
    stored: (id: TaskId) => stored.get(id.value),
    put: (task: Task) => stored.set(task.id.value, task),
    transaction,
    reviewLocks,
  };
};

const policy = (start: ReviewStart, skip = {}) => reviewsOf({ start, skip });

const finishedReview = (line: LineMap, id: string, at = new Date(0)) => {
  const run = RunId.of(`run_of_${id}`);

  return Task.add({
    line,
    // oxlint-disable-next-line typescript/no-non-null-assertion -- the review line has an entry
    at: line.entry!.id,
    title: TaskTitle.of('Retry uploads'),
    rank: TaskRank.of('i'),
    now: NOW,
    newId: () => id,
  })
    .reviews(PullRequestUrl.of(PULL), { outside: false }, line, at)
    .assignRun(run, line)
    .finishHere(run, line, {
      line,
      body: TaskNoteBody.of('Reviewed.'),
      at: NOW,
      voice: Voice.world(),
    });
};

const closedUnmerged = (): Happened => ({
  happening: 'github.pull_request.closed-unmerged',
  summary: 'The pull request was closed without being merged.',
  answers: false,
  state: 'raised',
  correlationKeys: {
    branch: null,
    marks: [{ kind: REVIEW_MARK, value: PULL }],
  },
  message: null,
  ourOwn: false,
  opens: null,
  closedPullRequest: PULL,
  closedUnmerged: true,
});

describe('ReactToHappenings, with a review request', () => {
  it('opens a task reviewing a pull request as it opens, on the line that reviews them', async () => {
    const line = reviewing({ reviews: policy('opened') });
    const { react, added, dispatched } = world({
      lines: [created(LineRole.DELIVERY), line],
    });

    await react(requested('opened'));

    expect(added).toHaveLength(1);
    const task = firstOf(added);
    expect(task?.stationId.value).toBe(line.entry?.id.value);
    expect(task?.title.value).toBe('Retry uploads');
    expect(task?.reviewing).toBe(true);
    expect(task?.reviewedPullRequest?.url.value).toBe(PULL);
    expect(task?.marks.map(String)).toEqual([`${REVIEW_MARK}:${PULL}`]);
    expect(task?.currentRunId?.value).toBe('run_1');
    expect(dispatched).toHaveLength(1);
  });

  it('leaves a review requested of a pull request whose head it cannot check out, as a happening that does not read', async () => {
    vi.mocked(logger.warn).mockClear();
    const { react, added } = world({
      lines: [reviewing({ reviews: policy('opened') })],
    });

    await expect(
      react(
        requested('opened', {
          pullRequest: 'https://github.com/acme/api/issues/7',
        }),
      ),
    ).resolves.toEqual({ kind: 'reacted' });

    expect(added).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: expect.stringMatching(/has no head to check out/) as unknown,
      }),
      'Left a happening that does not read as one',
    );
  });

  it('remembers whether the pull request under review came from outside the team', async () => {
    for (const outside of [true, false]) {
      const { react, added } = world({
        lines: [reviewing({ reviews: policy('opened') })],
      });

      await react(requested('opened', { outside }));

      expect(added[0]?.fromOutside).toBe(outside);
    }
  });

  it('waits to be mentioned where the line starts on a mention', async () => {
    const { react, added } = world({ lines: [reviewing()] });

    await react(requested('opened'));
    expect(added).toHaveLength(0);

    await react(requested('mentioned', { body: '@spotlight please review' }));
    expect(added).toHaveLength(1);
  });

  it('opens nothing for a comment that does not mention it', async () => {
    const { react, added } = world({ lines: [reviewing()] });

    await react(requested('mentioned', { body: '@octocat thoughts?' }));

    expect(added).toHaveLength(0);
  });

  it('reads a mention only in what was said, not in the name of a file that came with it', async () => {
    const { react, added } = world({ lines: [reviewing()] });

    await react({
      ...requested('mentioned'),
      attachments: [
        {
          name: '@spotlight.png',
          contentType: 'image/png',
          size: 3,
          fetch: async () => new Uint8Array([1, 2, 3]),
        },
      ],
    });

    expect(added).toHaveLength(0);
  });

  it('opens nothing where no line reviews pull requests', async () => {
    const { react, added } = world({
      lines: [created(LineRole.DELIVERY), reviewing({ reviews: null })],
    });

    await react(requested('mentioned', { body: '@spotlight review this' }));

    expect(added).toHaveLength(0);
  });

  it('reviews only pull requests in the repositories the line works in, where it names some', async () => {
    const elsewhere = world({
      lines: [reviewing({ reviews: policy('opened') }, ['acme/web'])],
    });
    await elsewhere.react(requested('opened'));
    expect(elsewhere.added).toHaveLength(0);

    const here = world({
      lines: [reviewing({ reviews: policy('opened') }, ['acme/api'])],
    });
    await here.react(requested('opened'));
    expect(here.added).toHaveLength(1);
  });

  it('opens nothing for a pull request in a repository that no line of the workspace names', async () => {
    vi.mocked(logger.info).mockClear();
    const { react, added } = world({
      lines: [reviewing({ reviews: policy('opened') })],
      connected: ['acme/web'],
    });

    await react(requested('opened'));
    await react(requested('mentioned', { body: '@spotlight please review' }));

    expect(added).toHaveLength(0);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'repository-not-connected',
        pullRequest: PULL,
      }),
      'Did not act on a happening',
    );
  });

  it('reviews, on a line that names no repositories, the repositories other lines of the workspace name', async () => {
    const { react, added } = world({
      lines: [reviewing({ reviews: policy('opened') })],
      connected: ['acme/api'],
    });

    await react(requested('opened'));

    expect(added).toHaveLength(1);
  });

  it('skips a pull request from a branch a task of Spotlight’s holds, unless told not to or a person labels it', async () => {
    const delivery = created(LineRole.DELIVERY);
    const own = Task.add({
      line: delivery,
      // oxlint-disable-next-line typescript/no-non-null-assertion -- the delivery line has an entry
      at: delivery.entry!.id,
      title: TaskTitle.of('Retry uploads'),
      rank: TaskRank.of('i'),
      now: NOW,
      newId: () => 'task_own',
    });
    const holding = (correlationKeys: CorrelationKeys) =>
      correlationKeys.branch?.equals(own.branch) ? own : null;

    const skipping = world({
      lines: [delivery, reviewing({ reviews: policy('opened') })],
      findByCorrelation: holding,
    });
    await skipping.react(requested('opened', { branch: own.branch.value }));
    expect(skipping.added).toHaveLength(0);

    const reviewingOwn = world({
      lines: [
        delivery,
        reviewing({ reviews: policy('opened', { spotlight: false }) }),
      ],
      findByCorrelation: holding,
    });
    await reviewingOwn.react(requested('opened', { branch: own.branch.value }));
    expect(reviewingOwn.added).toHaveLength(1);

    const labelling = world({
      lines: [delivery, reviewing({ reviews: policy('opened') })],
      findByCorrelation: holding,
    });
    await labelling.react(
      requested('labelled', { label: 'spotlight', branch: own.branch.value }),
    );
    expect(labelling.added).toHaveLength(1);
  });

  it('skips a pull request a task of Spotlight’s opened, however its branch is named', async () => {
    const delivery = created(LineRole.DELIVERY);
    const own = Task.add({
      line: delivery,
      // oxlint-disable-next-line typescript/no-non-null-assertion -- the delivery line has an entry
      at: delivery.entry!.id,
      title: TaskTitle.of('Retry uploads'),
      rank: TaskRank.of('i'),
      now: NOW,
      newId: () => 'task_own',
    });
    const { react, added } = world({
      lines: [delivery, reviewing({ reviews: policy('opened') })],
      owning: own,
    });

    await react(requested('opened', { branch: null }));

    expect(added).toHaveLength(0);
  });

  it('requests a review under way to look again when mentioned, rather than opening another', async () => {
    const line = reviewing();
    const underway = Task.add({
      line,
      // oxlint-disable-next-line typescript/no-non-null-assertion -- the review line has an entry
      at: line.entry!.id,
      title: TaskTitle.of('Retry uploads'),
      rank: TaskRank.of('i'),
      now: NOW,
      newId: () => 'task_review',
    }).reviews(PullRequestUrl.of(PULL), { outside: false }, line, new Date(0));
    const { react, added, saved } = world({
      lines: [line],
      tasks: [underway],
    });

    await react(requested('mentioned', { body: '@spotlight again please' }));

    expect(added).toHaveLength(0);
    expect(saved).toHaveLength(1);
    const notes = saved[0]?.notes ?? [];
    expect(notes[notes.length - 1]?.body.value).toContain(
      '@spotlight again please',
    );
  });

  it('opens a fresh review where the last one is finished', async () => {
    const line = reviewing();
    const finished = Task.rehydrate({
      revision: TaskRevision.first(),
      id: TaskId.of('task_done'),
      workspaceId: WorkspaceId.of('ws_1'),
      stationId: line.completed.id,
      title: TaskTitle.of('Retry uploads'),
      branch: Branch.of('feat/retry-uploads-0a1b2c3d'),
      description: null,
      rank: TaskRank.of('i'),
      currentRunId: null,
      session: null,
      claimedBy: null,
      notes: [],
      createdAt: NOW,
      originStationId: null,
      createdBy: null,
      openedFrom: TaskOrigin.person(),
      reviewedPullRequest: ReviewedPullRequest.of(PullRequestUrl.of(PULL), {
        outside: false,
      }),
      heldMarks: [HeldMark.of(Mark.review(PullRequestUrl.of(PULL)), NOW)],
      finishedAt: NOW,
      version: 0,
    });
    const { react, added } = world({
      lines: [line],
      tasks: [finished],
    });

    await react(requested('mentioned', { body: '@spotlight once more' }));

    expect(added).toHaveLength(1);
    expect(added[0]?.id.equals(finished.id)).toBe(false);
  });

  it('reviews again in the same task when a person labels the pull request again after the review finished', async () => {
    const line = reviewing({ reviews: policy('mentioned') });
    const finished = finishedReview(line, 'task_review');
    const { react, added, saved, dispatched } = world({
      lines: [line],
      tasks: [finished],
    });

    await react(requested('labelled', { label: 'spotlight' }));

    expect(added).toEqual([]);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.id.value).toBe('task_review');
    expect(saved[0]?.finished).toBe(false);
    expect(saved[0]?.stationId.equals(finished.stationId)).toBe(true);
    expect(saved[0]?.currentRunId?.value).toBe('run_1');
    expect(dispatched.map((each) => each.id.value)).toEqual(['task_review']);
  });

  it('reviews again in the task a label opened when Spotlight is mentioned after it finished', async () => {
    const line = reviewing({ reviews: policy('mentioned') });
    const { react, added, saved, stored, put } = world({ lines: [line] });

    await react(requested('labelled', { label: 'spotlight' }));
    const opened = firstOf(added);
    const review = opened && stored(opened.id);
    const run = review?.currentRunId;
    if (!review || !run) {
      throw new Error('The label opened no review.');
    }
    put(
      review.finishHere(run, line, {
        line,
        body: TaskNoteBody.of('Reviewed.'),
        at: NOW,
        voice: Voice.world(),
      }),
    );

    await react(requested('mentioned', { body: '@spotlight please look' }));

    expect(added).toHaveLength(1);
    expect(saved[saved.length - 1]?.id.equals(review.id)).toBe(true);
    expect(stored(review.id)?.finished).toBe(false);
    expect(stored(review.id)?.currentRunId?.value).toBe('run_1');
  });

  it('opens one review when two requests for the same pull request arrive at once', async () => {
    const line = reviewing({ reviews: policy('opened') });
    const { react, added, saved } = world({ lines: [line] });

    await Promise.all([
      react(requested('opened')),
      react(requested('labelled', { label: 'spotlight' })),
    ]);

    expect(added).toHaveLength(1);
    expect(saved.map((each) => each.id.value)).toEqual(
      added.map((each) => each.id.value),
    );
  });

  it('opens no second review for a delivery GitHub sends again', async () => {
    const line = reviewing({ reviews: policy('mentioned') });
    const { react, redeliver, added } = world({ lines: [line] });
    const labelled = requested('labelled', { label: 'spotlight' });

    await react(labelled);
    await redeliver(1, labelled);
    await react(labelled);

    expect(added).toHaveLength(1);
  });

  it('reviews no pull request that is already merged', async () => {
    const line = reviewing({ reviews: policy('mentioned') });
    const finished = finishedReview(line, 'task_review');
    const { react, added, saved } = world({
      lines: [line],
      tasks: [finished],
    });

    await react(requested('labelled', { label: 'spotlight', merged: true }));
    await react(
      requested('mentioned', { body: '@spotlight thanks', merged: true }),
    );

    expect(added).toEqual([]);
    expect(saved).toEqual([]);
  });

  it('completes every review of a pull request closed without a merge, also an older one opened twice', async () => {
    const line = reviewing({ reviews: policy('mentioned') });
    // The newer review took the review mark from the older one, as ReleaseTakenMarks does.
    const older = finishedReview(line, 'task_older', new Date(0)).releaseMark(
      Mark.review(PullRequestUrl.of(PULL)),
    );
    const newer = finishedReview(line, 'task_newer', new Date(1));
    const { react, redeliver, saved, stored } = world({
      lines: [line],
      tasks: [older, newer],
    });
    const closed = closedUnmerged();

    await react(closed);
    await redeliver(1, closed);

    expect(saved.map((each) => each.id.value).sort()).toEqual([
      'task_newer',
      'task_older',
    ]);
    for (const each of [older, newer]) {
      expect(stored(each.id)?.stationId.equals(line.completed.id)).toBe(true);
    }
  });

  it('closes, on a redelivery, a review that a failure left open after the newest review closed', async () => {
    const line = reviewing({ reviews: policy('mentioned') });
    const older = finishedReview(line, 'task_older', new Date(0)).releaseMark(
      Mark.review(PullRequestUrl.of(PULL)),
    );
    const newer = finishedReview(line, 'task_newer', new Date(1));
    const { react, redeliver, saved, stored } = world({
      lines: [line],
      tasks: [older, newer],
      failsToSaveOnce: 'task_older',
    });

    await expect(react(closedUnmerged())).rejects.toThrow(
      'The database went away.',
    );
    expect(stored(older.id)?.stationId.equals(line.completed.id)).toBe(false);

    await redeliver(1, closedUnmerged());

    expect(saved.map((each) => each.id.value)).toEqual([
      'task_newer',
      'task_older',
    ]);
    expect(stored(older.id)?.stationId.equals(line.completed.id)).toBe(true);
  });

  it('holds the close back from another review whose run is still deciding its turn', async () => {
    const line = reviewing({ reviews: policy('mentioned') });
    const run = RunId.of('run_turn');
    const deciding = Task.add({
      line,
      // oxlint-disable-next-line typescript/no-non-null-assertion -- the review line has an entry
      at: line.entry!.id,
      title: TaskTitle.of('Retry uploads'),
      rank: TaskRank.of('i'),
      now: NOW,
      newId: () => 'task_older',
    })
      .reviews(PullRequestUrl.of(PULL), { outside: false }, line, new Date(0))
      .assignRun(run, line)
      .releaseMark(Mark.review(PullRequestUrl.of(PULL)));
    const newer = finishedReview(line, 'task_newer', new Date(1));
    const { react, saved } = world({
      lines: [line],
      tasks: [deciding, newer],
      runs: partial<RunFactsPort>({
        of: async (ids) =>
          ids.some((each) => each.equals(run))
            ? [
                partial<RunFacts>({
                  runId: run,
                  turn: 'pending',
                  suspendedAt: new Date(NOW.getTime() - 60_000),
                }),
              ]
            : [],
      }),
    });

    await expect(react(closedUnmerged())).resolves.toMatchObject({
      kind: 'failed',
      transient: true,
    });
    expect(saved.map((each) => each.id.value)).toEqual(['task_newer']);
  });

  it('closes the reviews of a pull request only once a review request of it lets go of the pull request', async () => {
    const line = reviewing({ reviews: policy('mentioned') });
    const older = finishedReview(line, 'task_older', new Date(0)).releaseMark(
      Mark.review(PullRequestUrl.of(PULL)),
    );
    const newer = finishedReview(line, 'task_newer', new Date(1));
    const { react, saved, transaction, reviewLocks } = world({
      lines: [line],
      tasks: [older, newer],
    });
    let letGo = () => {};
    const requesting = new Promise<void>((resolve) => {
      letGo = resolve;
    });
    let locked = () => {};
    const holding = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const request = transaction.inTransaction(async () => {
      await reviewLocks.lock(WorkspaceId.of('ws_1'), PullRequestUrl.of(PULL));
      locked();
      await requesting;
    });
    await holding;

    const closing = react(closedUnmerged());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(saved).toEqual([]);

    letGo();
    await request;
    await closing;
    expect(saved.map((each) => each.id.value).sort()).toEqual([
      'task_newer',
      'task_older',
    ]);
  });
});
