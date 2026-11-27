import type {
  AnswerGraderPort,
  GradedAnswer,
  GradingRequest,
} from '@change-review/application/ports/answer-grader.port';
import {
  SESSION_WAITING,
  type SessionWaiting,
} from '@change-review/application/ports/session-waiting';
import { WorkAnswerGrades } from '@change-review/application/services/work-answer-grades.service';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { QuestionAnswerRepository } from '@change-review/domain/repositories/question-answer.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { commitSha } from '@change-review/domain/value-objects/commit-sha.fake-spec';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { GradingRound } from '@change-review/domain/value-objects/grading-round.vo';
import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import { SessionFailure } from '@change-review/domain/value-objects/session-failure.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import {
  HunkId,
  QuestionId,
} from '@change-review/domain/value-objects/stack-ids';
import { StackOrigin } from '@change-review/domain/value-objects/stack-origin.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { MAX_JOB_ATTEMPTS } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-02T10:00:00Z');

const DAY = 24 * 60 * 60 * 1000;

const PATCH = '@@ -1 +1 @@\n-bot\n+member ?? integration';

const QUIET: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const stackOf = (id: string, origin: StackOrigin): ChangeStack =>
  ChangeStack.startGeneration({
    id: ChangeStackId.of(id),
    origin,
    taskId: TaskId.of('task-1'),
    teamOfRun: null,
    trial: false,
    checkouts: 1,
    workspaceId: WorkspaceId.of('workspace-1'),
    owner: 'acme',
    repository: 'web',
    base: null,
    diff: Diff.of([
      {
        path: 'slack.ts',
        previousPath: null,
        status: 'modified',
        binary: false,
        hunks: [
          {
            id: HunkId.of('h1'),
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 1,
            patch: PATCH,
          },
        ],
      },
    ]),
    facts: StackFacts.of({ hunks: [], links: [], imports: [] }),
    request: null,
    now: NOW,
  }).propose(
    [
      {
        kind: 'change',
        title: 'Sign as the member',
        intent: 'Sign messages as the member who wrote them',
        layers: [
          {
            title: 'Sign as the member',
            summary: 'Falls back to the integration',
            dependsOn: [],
            hunks: [{ hunk: 'h1' }],
            notes: [{ path: 'slack.ts', note: 'Picks the signer' }],
            questions: [
              {
                question: 'Who signs when the member has left?',
                answer: 'The integration signs it.',
                hunks: ['h1'],
              },
            ],
          },
        ],
      },
    ],
    NOW,
  );

const RUN_STACK = stackOf('stack-1', StackOrigin.run(RunId.of('run-1')));

const PUSHED_STACK = stackOf(
  'stack-2',
  StackOrigin.push(commitSha('b'), Pusher.of('octocat')),
);

const answered = (stack: ChangeStack, reply: string | null = 'The bot.') =>
  QuestionAnswer.given({
    id: QuestionAnswerId.of('answer-1'),
    stack,
    question: stack.question(QuestionId.of('c1.l1.q1')),
    personId: UserId.of('user-1'),
    reply,
    now: NOW,
  });

const grading = (
  initial: QuestionAnswer,
  answer: (request: GradingRequest) => Promise<GradedAnswer | SessionWaiting>,
  stacks: readonly ChangeStack[] = [RUN_STACK],
) => {
  let stored = initial;
  const grade = vi.fn(answer);

  const answers = partial<QuestionAnswerRepository>({
    find: async () => stored,
    save: async (saved: QuestionAnswer) => {
      stored = saved;
    },
    nextDueGrading: async (at: Date) =>
      stored.hasPendingJob && stored.job.isDue(at) ? stored : null,
  });
  const stackRepository = partial<ChangeStackRepository>({
    find: async (id: ChangeStackId) =>
      stacks.find((each) => each.id.equals(id)) ?? null,
    ofTask: async () => stacks,
  });
  const grader: AnswerGraderPort = { grade };
  let now = NOW;

  const service = new WorkAnswerGrades(
    answers,
    stackRepository,
    grader,
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    { now: () => now, sleep: async () => {} },
    QUIET,
    { report: () => undefined },
    telemetryInMemory(),
  );

  const tick = async (at: Date) => {
    now = at;
    await service.processDue();
    await service.idle();
  };

  return { tick, grade, stored: () => stored };
};

const GRADED = async (): Promise<GradedAnswer> => ({
  status: 'graded',
  grade: { verdict: 'partly-right', feedback: 'Not the bot.' },
  usage: { inputTokens: 300, outputTokens: 40, cost: null },
});

describe('WorkAnswerGrades', () => {
  it('grades a pending answer in a session based on the stack’s run, against the hunks that show the answer', async () => {
    const worked = grading(answered(RUN_STACK), GRADED);

    await worked.tick(NOW);

    expect(worked.grade).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      round: GradingRound.of({
        answerId: QuestionAnswerId.of('answer-1'),
        answeredAt: NOW,
        attempt: 1,
      }),
      basedOnRun: RunId.of('run-1'),
      question: 'Who signs when the member has left?',
      expected: 'The integration signs it.',
      reply: 'The bot.',
      cited: [{ path: 'slack.ts', patch: PATCH }],
    });
    expect(worked.stored()).toMatchObject({
      grading: 'graded',
      verdict: 'partly-right',
      feedback: 'Not the bot.',
    });
    expect(worked.stored().usage.calls).toBe(1);
  });

  it('bases the session for a pushed stack on the newest run of the task', async () => {
    const worked = grading(answered(PUSHED_STACK), GRADED, [
      RUN_STACK,
      PUSHED_STACK,
    ]);

    await worked.tick(NOW);

    expect(worked.grade).toHaveBeenCalledWith(
      expect.objectContaining({ basedOnRun: RunId.of('run-1') }),
    );
  });

  it('leaves the answer ungraded where no run can host the session', async () => {
    const worked = grading(answered(PUSHED_STACK), GRADED, [PUSHED_STACK]);

    await worked.tick(NOW);

    expect(worked.grade).not.toHaveBeenCalled();
    expect(worked.stored().grading).toBe('failed');
    expect(worked.stored().expected).toBe('The integration signs it.');
  });

  it('waits for its session in the same round without spending attempts', async () => {
    let waits = MAX_JOB_ATTEMPTS + 1;
    const worked = grading(answered(RUN_STACK), async () => {
      if (waits > 0) {
        waits -= 1;
        return SESSION_WAITING;
      }
      return GRADED();
    });

    for (let at = 0; at <= MAX_JOB_ATTEMPTS + 1; at += 1) {
      await worked.tick(new Date(NOW.getTime() + at * 60_000));
    }

    expect(
      new Set(
        worked.grade.mock.calls.map(([request]) => request.round.attempt),
      ),
    ).toEqual(new Set([1]));
    expect(worked.stored().grading).toBe('graded');
  });

  it('grades again in a new round after a session gave no grade, then gives up', async () => {
    const worked = grading(answered(RUN_STACK), async () => ({
      status: 'failed',
      failure: SessionFailure.of('no-result'),
    }));

    for (let day = 0; day < MAX_JOB_ATTEMPTS; day += 1) {
      await worked.tick(new Date(NOW.getTime() + day * DAY));
    }

    expect(
      worked.grade.mock.calls.map(([request]) => request.round.attempt),
    ).toEqual([1, 2, 3, 4]);
    expect(worked.stored().grading).toBe('failed');
    expect(worked.stored().hasPendingJob).toBe(false);
  });

  it('gives up at once where no harness can run the session, or its run is in another workspace', async () => {
    for (const reason of ['no-harness', 'base-run-elsewhere'] as const) {
      const worked = grading(answered(RUN_STACK), async () => ({
        status: 'failed',
        failure: SessionFailure.of(reason),
      }));

      await worked.tick(NOW);

      expect(worked.grade).toHaveBeenCalledTimes(1);
      expect(worked.stored().grading).toBe('failed');
    }
  });

  it('has nothing to grade for an answer of “I don’t know”', async () => {
    const worked = grading(answered(RUN_STACK, null), GRADED);

    await worked.tick(NOW);

    expect(worked.grade).not.toHaveBeenCalled();
    expect(worked.stored().verdict).toBe('missed');
  });
});
