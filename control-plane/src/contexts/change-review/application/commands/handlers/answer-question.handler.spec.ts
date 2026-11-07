import { AnswerQuestionCommand } from '@change-review/application/commands/answer-question.command';
import { AnswerQuestionHandler } from '@change-review/application/commands/handlers/answer-question.handler';
import type { AnswerGraderPort } from '@change-review/application/ports/answer-grader.port';
import type { RunForReview } from '@change-review/application/ports/work.port';
import type { TeamWorkAccess } from '@change-review/application/services/team-work-access.service';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';
import { QuestionAnswerVersionConflictError } from '@change-review/domain/exceptions/question-answer-version-conflict.error';
import { TeamMembershipRequiredError } from '@change-review/domain/exceptions/team-membership-required.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { QuestionAnswerRepository } from '@change-review/domain/repositories/question-answer.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { TeamStanding } from '@change-review/domain/value-objects/team-standing.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-02T10:00:00Z');

const DIFF = Diff.of([
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
        patch: '@@ -1 +1 @@\n-bot\n+member ?? integration',
      },
    ],
  },
]);

const asking = (question = 'Who signs when the member has left?') =>
  ChangeStack.startGeneration({
    id: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: TaskId.of('task-1'),
    teamOfRun: TeamId.of('team_1'),
    trial: false,
    checkouts: 1,
    workspaceId: WorkspaceId.of('workspace-1'),
    repository: null,
    base: null,
    diff: DIFF,
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
            hunks: [{ hunk: HunkId.of('h1') }],
            notes: [{ path: 'slack.ts', note: 'Picks the signer' }],
            questions: [
              {
                question,
                answer: 'The integration signs it.',
                hunks: [HunkId.of('h1')],
              },
            ],
          },
        ],
      },
    ],
    NOW,
  );

const RUN = { id: RunId.of('run-1') } as RunForReview;

const answering = (
  over: {
    run?: RunForReview | null;
    onTeam?: boolean;
    earlier?: QuestionAnswer | null;
    answeredMeanwhile?: QuestionAnswer;
    graderAvailable?: boolean;
  } = {},
) => {
  const added: QuestionAnswer[] = [];
  let stored = over.earlier ?? null;
  const saved: QuestionAnswer[] = [];
  const grade = vi.fn(async () => ({
    grade: { verdict: 'partly-right' as const, feedback: 'Not the bot.' },
    usage: null,
  }));

  const handler = new AnswerQuestionHandler(
    {
      actingOnRun: async (
        _teamId: string,
        _runId: string,
        _viewerId: string,
        unseen: () => Error,
      ) =>
        TeamStanding.of({ actsForTeam: over.onTeam !== false }).actingOn(
          over.run === undefined ? RUN : over.run,
          unseen,
        ),
    } as unknown as TeamWorkAccess,
    { find: async () => asking() } as unknown as ChangeStackRepository,
    {
      of: async () => stored,
      add: async (answer: QuestionAnswer) => {
        if (over.answeredMeanwhile && !stored) {
          stored = over.answeredMeanwhile;
          throw new QuestionAnswerVersionConflictError(answer.id.value);
        }
        added.push(answer);
      },
      save: async (answer: QuestionAnswer) => {
        saved.push(answer);
      },
      ofTask: async () => [],
      ofTeam: async () => [],
      remove: async () => {},
    } satisfies QuestionAnswerRepository,
    {
      available: over.graderAvailable !== false,
      grade,
    } satisfies AnswerGraderPort,
    { generate: () => 'answer-1' },
    { now: () => NOW, sleep: async () => {} },
  );

  return { handler, grade, added, saved };
};

const answer = (reply: string | null, questionId = 'c1.l1.q1') =>
  new AnswerQuestionCommand(
    'team-1',
    'run-1',
    'stack-1',
    questionId,
    'user-1',
    reply,
  );

describe('AnswerQuestionHandler', () => {
  it('grades an answer in words against the expected answer and the hunks that show it', async () => {
    const { handler, grade, added } = answering();

    await handler.execute(answer('The bot signs it.'));

    expect(grade).toHaveBeenCalledWith({
      question: 'Who signs when the member has left?',
      expected: 'The integration signs it.',
      reply: 'The bot signs it.',
      cited: [
        {
          path: 'slack.ts',
          patch: '@@ -1 +1 @@\n-bot\n+member ?? integration',
        },
      ],
    });
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      questionId: 'c1.l1.q1',
      reply: 'The bot signs it.',
      verdict: 'partly-right',
      feedback: 'Not the bot.',
      expected: 'The integration signs it.',
    });
  });

  it('shows the expected answer without a model call when the reviewer does not know', async () => {
    const { handler, grade, added } = answering({ graderAvailable: false });

    await handler.execute(answer(null));

    expect(grade).not.toHaveBeenCalled();
    expect(added[0]?.verdict).toBe('missed');
    expect(added[0]?.expected).toBe('The integration signs it.');
  });

  it('refuses a second answer to the same question', async () => {
    const { handler: first, added } = answering();
    await first.execute(answer(null));

    const { handler } = answering({ earlier: added[0] });

    await expect(
      handler.execute(answer('The integration.')),
    ).rejects.toMatchObject({
      kind: 'conflict',
      message: 'You already answered this question.',
    });
  });

  it('reloads after an answer given meanwhile took the key, and refuses the second', async () => {
    const { handler: first, added: before } = answering();
    await first.execute(answer(null));

    const { handler, added } = answering({
      answeredMeanwhile: before[0] as QuestionAnswer,
    });

    await expect(handler.execute(answer(null))).rejects.toMatchObject({
      kind: 'conflict',
      message: 'You already answered this question.',
    });
    expect(added).toEqual([]);
  });

  it('answers again, on the same answer, a question the stack asks in other words since it was redrafted', async () => {
    const { handler: first, added: before } = answering();
    await first.execute(answer(null));
    const stale = before[0] as QuestionAnswer;
    Object.defineProperty(stale, 'asked', { value: 'An older question?' });

    const { handler, added, saved } = answering({ earlier: stale });
    await handler.execute(answer(null));

    expect(added).toEqual([]);
    expect(saved[0]?.id).toEqual(stale.id);
    expect(saved[0]?.asked).toBe('Who signs when the member has left?');
  });

  it('refuses a reply too long before it pays for grading', async () => {
    const { handler, grade } = answering();

    await expect(
      handler.execute(answer('x'.repeat(4_001))),
    ).rejects.toMatchObject({ kind: 'invalid' });
    expect(grade).not.toHaveBeenCalled();
  });

  it('refuses a second answer before it pays for grading', async () => {
    const { handler: first, added } = answering();
    await first.execute(answer(null));
    const { handler, grade } = answering({ earlier: added[0] });

    await expect(handler.execute(answer('Again.'))).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(grade).not.toHaveBeenCalled();
  });

  it('refuses a workspace member outside the team, and records nothing', async () => {
    const { handler, added, saved, grade } = answering({ onTeam: false });

    await expect(
      handler.execute(answer('The integration.')),
    ).rejects.toMatchObject({
      refusal: expect.any(TeamMembershipRequiredError),
    });
    expect(added).toEqual([]);
    expect(saved).toEqual([]);
    expect(grade).not.toHaveBeenCalled();
  });

  it('hides a stack the caller cannot see, and a question the stack does not ask', async () => {
    await expect(
      answering({ run: null }).handler.execute(answer(null)),
    ).rejects.toMatchObject({ kind: 'not-found' });
    await expect(
      answering().handler.execute(answer(null, 'c1.l1.q2')),
    ).rejects.toMatchObject({ kind: 'not-found' });
    await expect(
      answering().handler.execute(answer(null, 'not-a-question')),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('cannot grade words when no model is set up', async () => {
    await expect(
      answering({ graderAvailable: false }).handler.execute(
        answer('The integration.'),
      ),
    ).rejects.toMatchObject({ kind: 'upstream-error' });
  });
});
