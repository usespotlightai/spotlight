import type {
  AssistRoundsPort,
  SessionRound,
} from '@change-review/application/ports/assist-rounds.port';
import { WakeSessionWaits } from '@change-review/application/services/wake-session-waits.service';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';
import { ChangeStackVersionConflictError } from '@change-review/domain/exceptions/change-stack-version-conflict.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { QuestionAnswerRepository } from '@change-review/domain/repositories/question-answer.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { DraftingRound } from '@change-review/domain/value-objects/drafting-round.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import {
  HunkId,
  QuestionId,
} from '@change-review/domain/value-objects/stack-ids';
import { StackOrigin } from '@change-review/domain/value-objects/stack-origin.vo';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-21T10:00:00Z');
const SETTLED = new Date('2026-11-21T10:00:20Z');

const waitingStack = () =>
  ChangeStack.startGeneration({
    id: ChangeStackId.of('stack-1'),
    origin: StackOrigin.run(RunId.of('run-1')),
    taskId: null,
    teamOfRun: TeamId.of('team_1'),
    trial: false,
    checkouts: 1,
    workspaceId: WorkspaceId.of('workspace-1'),
    owner: 'acme',
    repository: 'web',
    base: null,
    diff: Diff.of([
      {
        path: 'retry.ts',
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
            patch: '@@ -1 +1 @@\n-once\n+twice',
          },
        ],
      },
    ]),
    facts: StackFacts.of({ hunks: [], links: [], imports: [] }),
    request: null,
    now: NOW,
  })
    .leaseJob(NOW)
    .waitJob(NOW);

const waitingAnswer = () =>
  QuestionAnswer.given({
    id: QuestionAnswerId.of('answer-1'),
    stack: {
      id: ChangeStackId.of('stack-1'),
      workspaceId: WorkspaceId.of('workspace-1'),
      taskId: TaskId.of('task-1'),
      teamId: null,
      repository: null,
    },
    question: {
      id: QuestionId.of('c1.l1.q1'),
      question: 'Who signs it?',
      answer: 'The integration.',
      hunks: [HunkId.of('h1')],
    },
    personId: UserId.of('user-1'),
    reply: 'The bot.',
    now: NOW,
  })
    .leaseJob(NOW)
    .waitJob(NOW);

const waking = (
  round: SessionRound | null,
  over: { conflict?: boolean } = {},
) => {
  let stack = waitingStack();
  let answer = waitingAnswer();
  const rounds: AssistRoundsPort = { roundOf: () => round };
  const stacks = partial<ChangeStackRepository>({
    find: async () => stack,
    save: async (saved: ChangeStack) => {
      if (over.conflict) {
        throw new ChangeStackVersionConflictError(saved.id.value);
      }
      stack = saved;
    },
  });
  const answers = partial<QuestionAnswerRepository>({
    find: async () => answer,
    save: async (saved: QuestionAnswer) => {
      answer = saved;
    },
  });

  return {
    service: new WakeSessionWaits(
      rounds,
      stacks,
      answers,
      { inTransaction: (work) => work() },
      { now: () => SETTLED, sleep: async () => {} },
    ),
    stack: () => stack,
    answer: () => answer,
  };
};

const SESSION = {
  purpose: 'change-review.change-stack',
  key: 'stack-1:draft:1',
};

describe('waking the jobs that wait for assist sessions', () => {
  it('makes the stack that waits for its drafting session due once the session settles', async () => {
    const woken = waking({
      of: 'drafting',
      round: DraftingRound.draft(ChangeStackId.of('stack-1'), 1),
    });

    await woken.service.settled(SESSION);

    expect(woken.stack().job.isDue(SETTLED)).toBe(true);
    expect(woken.answer().job.isDue(SETTLED)).toBe(false);
  });

  it('makes the answer that waits for its grading session due once the session settles', async () => {
    const woken = waking({
      of: 'grading',
      round: waitingAnswer().gradingRound,
    });

    await woken.service.settled(SESSION);

    expect(woken.answer().job.isDue(SETTLED)).toBe(true);
    expect(woken.stack().job.isDue(SETTLED)).toBe(false);
  });

  it('wakes nothing for a session change review did not order', async () => {
    const woken = waking(null);

    await woken.service.settled({ purpose: 'insights.judge', key: 'run-1' });

    expect(woken.stack().job.isDue(SETTLED)).toBe(false);
    expect(woken.answer().job.isDue(SETTLED)).toBe(false);
  });

  it('leaves a job someone saved meanwhile to whoever works it', async () => {
    const woken = waking(
      {
        of: 'drafting',
        round: DraftingRound.draft(ChangeStackId.of('stack-1'), 1),
      },
      { conflict: true },
    );

    await expect(woken.service.settled(SESSION)).resolves.toBeUndefined();
  });
});
