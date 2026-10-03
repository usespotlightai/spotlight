import type { MemberReaderPort } from '@identity/application/ports/member-reader.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  type Happened,
  PULL_REQUEST_MARK,
  REVIEW_MARK,
} from '@work/application/contracts/happenings.contract';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import { heardInMemory } from '@work/application/ports/heard-happenings.fake-spec';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { ReactToHappenings } from '@work/application/services/react-to-happenings.service';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import type { Concerns } from '@work/domain/value-objects/concerns.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { PullRequestLink } from '@work/domain/value-objects/pull-request-link.vo';
import { ReviewPolicy } from '@work/domain/value-objects/review-policy.vo';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { WorkedRepository } from '@work/domain/value-objects/worked-repository.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-18T12:00:00.000Z');
const PULL = 'https://github.com/acme/api/pull/7';
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };
const transaction: TransactionPort = { run: async (work) => work() };
const members: MemberReaderPort = {
  listForTeam: async () => null,
  byEmail: async () => null,
  onTeam: async () => false,
};
const files = {
  grant: vi.fn(),
  received: vi.fn(async () => []),
  keep: vi.fn(),
  link: vi.fn(),
  open: vi.fn(),
} satisfies AttachmentStorePort;
const logger: LoggerPort = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const opening = (role: LineRole): LineOpening => {
  const found = BUILT_IN_LINES.find((each) => each.role?.equals(role));

  if (!found) {
    throw new Error(`no built-in line plays ${role.value}`);
  }

  return found;
};

let made = 0;

const fresh = (prefix: string): string => {
  made += 1;
  return `${prefix}_${made}`;
};

const opened = (
  role: LineRole,
  over: Partial<LineOpening> = {},
  repositories: readonly string[] = [],
) =>
  Line.open({
    by: attributedIn(),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    line: { ...opening(role), ...over },
    newId: () => fresh('id'),
  })
    .runsOn(HarnessId.of('dev'), null)
    .worksIn(
      repositories.map((each) =>
        WorkedRepository.of(
          // biome-ignore lint/style/noNonNullAssertion: a pull request’s address always names its repository
          PullRequestUrl.of(`https://github.com/${each}/pull/1`).repository!,
        ),
      ),
    );

const reviewing = (over: Partial<LineOpening> = {}, repositories?: string[]) =>
  opened(LineRole.REVIEW, over, repositories);

const asked = (
  asking: 'opened' | 'mentioned',
  over: {
    body?: string;
    draft?: boolean;
    branch?: string | null;
    outside?: boolean;
    pullRequest?: string;
  } = {},
): Happened => {
  const pullRequest = over.pullRequest ?? PULL;
  const marks = [{ kind: REVIEW_MARK, value: pullRequest }];

  return {
    happening: `github.pull_request.${asking}`,
    told: 'A pull request wants a review.',
    spoken: asking === 'mentioned',
    state: 'raised',
    concerns: { branch: null, marks },
    said: over.body ? { body: over.body } : null,
    ourOwn: false,
    opens: {
      onto: 'review',
      at: null,
      title: 'Retry uploads',
      description: `Review ${pullRequest}`,
      assignEmail: null,
      marks,
      review: {
        asking,
        pullRequest,
        author: 'octocat',
        outside: over.outside ?? true,
        draft: over.draft ?? false,
        branch: over.branch === undefined ? 'fix-uploads' : over.branch,
      },
    },
  };
};

const world = (input: {
  lines: readonly Line[];
  holding?: (concerns: Concerns) => Task | null;
}) => {
  const added: Task[] = [];
  const saved: Task[] = [];
  const dispatched: Task[] = [];

  const tasks = {
    add: vi.fn(async (each: Task) => {
      added.push(each);
    }),
    save: vi.fn(async (each: Task) => {
      saved.push(each);
    }),
    find: vi.fn(async () => null),
    remove: vi.fn(),
    standingAt: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
    holding: vi.fn(
      async (_at: WorkspaceId, concerns: Concerns) =>
        input.holding?.(concerns) ?? null,
    ),
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
  } satisfies TaskRepository & TaskPlacementsPort;

  const lines = {
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => null),
    holding: vi.fn(
      async (stationId) =>
        input.lines.find((line) => line.stationAt(stationId)) ?? null,
    ),
    ofWorkspace: vi.fn(async () => input.lines),
    ofTeam: vi.fn(async () => input.lines),
  } satisfies LineRepository;

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
    heardInMemory(),
    logger,
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
    added,
    saved,
    dispatched,
  };
};

const policy = (start: string, skip = {}) => ReviewPolicy.of({ start, skip });

describe('ReactToHappenings, asked for a review', () => {
  it('opens a task reviewing a pull request as it opens, on the line that reviews them', async () => {
    const line = reviewing({ reviews: policy('opened') });
    const { react, added, dispatched } = world({
      lines: [opened(LineRole.DELIVERY), line],
    });

    await react(asked('opened'));

    expect(added).toHaveLength(1);
    const [task] = added;
    expect(task?.stationId.value).toBe(line.entry?.id.value);
    expect(task?.title.value).toBe('Retry uploads');
    expect(task?.reviewing).toBe(true);
    expect(task?.pullRequest?.value).toBe(PULL);
    expect(task?.marks.map(String)).toEqual([`${REVIEW_MARK}:${PULL}`]);
    expect(task?.currentRunId?.value).toBe('run_1');
    expect(dispatched).toHaveLength(1);
  });

  it('leaves a review asked of a pull request whose head it cannot check out, as a happening that does not read', async () => {
    vi.mocked(logger.warn).mockClear();
    const { react, added } = world({
      lines: [reviewing({ reviews: policy('opened') })],
    });

    await expect(
      react(
        asked('opened', {
          pullRequest: 'https://github.com/acme/api/issues/7',
        }),
      ),
    ).resolves.toBeUndefined();

    expect(added).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: expect.stringMatching(/whose head it can check out/),
      }),
      'Left a happening that does not read as one',
    );
  });

  it('remembers whether the pull request under review came from outside the team', async () => {
    for (const outside of [true, false]) {
      const { react, added } = world({
        lines: [reviewing({ reviews: policy('opened') })],
      });

      await react(asked('opened', { outside }));

      expect(added[0]?.fromOutside).toBe(outside);
    }
  });

  it('waits to be mentioned where the line starts on a mention', async () => {
    const { react, added } = world({ lines: [reviewing()] });

    await react(asked('opened'));
    expect(added).toHaveLength(0);

    await react(asked('mentioned', { body: '@spotlight please review' }));
    expect(added).toHaveLength(1);
  });

  it('opens nothing for a comment that does not mention it', async () => {
    const { react, added } = world({ lines: [reviewing()] });

    await react(asked('mentioned', { body: '@octocat thoughts?' }));

    expect(added).toHaveLength(0);
  });

  it('opens nothing where no line reviews pull requests', async () => {
    const { react, added } = world({
      lines: [opened(LineRole.DELIVERY), reviewing({ reviews: null })],
    });

    await react(asked('mentioned', { body: '@spotlight review this' }));

    expect(added).toHaveLength(0);
  });

  it('reviews only pull requests in the repositories the line works in, where it names some', async () => {
    const elsewhere = world({
      lines: [reviewing({ reviews: policy('opened') }, ['acme/web'])],
    });
    await elsewhere.react(asked('opened'));
    expect(elsewhere.added).toHaveLength(0);

    const here = world({
      lines: [reviewing({ reviews: policy('opened') }, ['acme/api'])],
    });
    await here.react(asked('opened'));
    expect(here.added).toHaveLength(1);
  });

  it('skips a pull request from one of Spotlight’s branches, unless told not to', async () => {
    const skipping = world({
      lines: [reviewing({ reviews: policy('opened') })],
    });
    await skipping.react(asked('opened', { branch: 'spotlight/task_9' }));
    expect(skipping.added).toHaveLength(0);

    const reviewingOwn = world({
      lines: [reviewing({ reviews: policy('opened', { spotlight: false }) })],
    });
    await reviewingOwn.react(asked('opened', { branch: 'spotlight/task_9' }));
    expect(reviewingOwn.added).toHaveLength(1);
  });

  it('skips a pull request a task of Spotlight’s opened, however its branch is named', async () => {
    const delivery = opened(LineRole.DELIVERY);
    const own = Task.add({
      line: delivery,
      // biome-ignore lint/style/noNonNullAssertion: the delivery line has an entry
      at: delivery.entry!.id,
      title: TaskTitle.of('Retry uploads'),
      rank: TaskRank.of('i'),
      now: NOW,
      newId: () => 'task_own',
    }).markedBy(Mark.pullRequest(PullRequestUrl.of(PULL)));
    const { react, added } = world({
      lines: [delivery, reviewing({ reviews: policy('opened') })],
      holding: (concerns) =>
        concerns.marks.some((mark) => mark.kind === PULL_REQUEST_MARK)
          ? own
          : null,
    });

    await react(asked('opened', { branch: null }));

    expect(added).toHaveLength(0);
  });

  it('asks a review under way to look again when mentioned, rather than opening another', async () => {
    const line = reviewing();
    const underway = Task.add({
      line,
      // biome-ignore lint/style/noNonNullAssertion: the review line has an entry
      at: line.entry!.id,
      title: TaskTitle.of('Retry uploads'),
      rank: TaskRank.of('i'),
      now: NOW,
      newId: () => 'task_review',
    }).reviews(PullRequestUrl.of(PULL), { outside: false });
    const { react, added, saved } = world({
      lines: [line],
      holding: (concerns) =>
        concerns.marks.some((mark) => mark.kind === REVIEW_MARK)
          ? underway
          : null,
    });

    await react(asked('mentioned', { body: '@spotlight again please' }));

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
      description: null,
      rank: TaskRank.of('i'),
      currentRunId: null,
      sessionId: null,
      runnerId: null,
      notes: [],
      createdAt: NOW,
      raisedAt: null,
      raisedBy: null,
      openedFrom: TaskOrigin.person(),
      pullRequestLink: PullRequestLink.reviewing(PullRequestUrl.of(PULL), {
        outside: false,
      }),
      marks: [Mark.review(PullRequestUrl.of(PULL))],
      finishedAt: NOW,
    });
    const { react, added } = world({
      lines: [line],
      holding: () => finished,
    });

    await react(asked('mentioned', { body: '@spotlight once more' }));

    expect(added).toHaveLength(1);
    expect(added[0]?.id.equals(finished.id)).toBe(false);
  });
});
