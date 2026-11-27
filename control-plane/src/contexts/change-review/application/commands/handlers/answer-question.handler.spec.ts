import { AnswerQuestionCommand } from '@change-review/application/commands/answer-question.command';
import { AnswerQuestionHandler } from '@change-review/application/commands/handlers/answer-question.handler';
import type {
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { TeamWorkAccess } from '@change-review/application/services/team-work-access.service';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';
import { QuestionAnswerVersionConflictError } from '@change-review/domain/exceptions/question-answer-version-conflict.error';
import { TeamMembershipRequiredError } from '@change-review/domain/exceptions/team-membership-required.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { QuestionAnswerRepository } from '@change-review/domain/repositories/question-answer.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { commitSha } from '@change-review/domain/value-objects/commit-sha.fake-spec';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { StackOrigin } from '@change-review/domain/value-objects/stack-origin.vo';
import type { StackVisibility } from '@change-review/domain/value-objects/stack-visibility.vo';
import { TeamStanding } from '@change-review/domain/value-objects/team-standing.vo';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
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

const asking = (
  question = 'Who signs when the member has left?',
  origin: StackOrigin = StackOrigin.run(RunId.of('run-1')),
) =>
  ChangeStack.startGeneration({
    id: ChangeStackId.of('stack-1'),
    origin,
    taskId: TaskId.of('task-1'),
    teamOfRun: TeamId.of('team_1'),
    trial: false,
    checkouts: 1,
    workspaceId: WorkspaceId.of('workspace-1'),
    owner: 'acme',
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

const answering = (
  over: {
    seen?: boolean;
    stack?: ChangeStack;
    access?: TeamWorkAccess;
    onTeam?: boolean;
    earlier?: QuestionAnswer | null;
    answeredMeanwhile?: QuestionAnswer;
    inTask?: readonly QuestionAnswer[];
    takenOnTask?: QuestionAnswer;
    takenOnSave?: QuestionAnswer;
  } = {},
) => {
  const added: QuestionAnswer[] = [];
  let stored = over.earlier ?? null;
  let taken: QuestionAnswer | null = null;
  const saved: QuestionAnswer[] = [];

  const handler = new AnswerQuestionHandler(
    over.access ??
      partial<TeamWorkAccess>({
        actingOnStack: (
          _teamId: string,
          visibility: StackVisibility | null,
          _viewerId: string,
          unseen: () => Error,
        ) =>
          new Promise<void>((resolve) => {
            TeamStanding.of({ actsOnTeam: over.onTeam !== false }).actingOn(
              over.seen === false ? null : visibility,
              unseen,
            );
            resolve();
          }),
      }),
    partial<ChangeStackRepository>({
      find: () => Promise.resolve(over.stack ?? asking()),
    }),
    {
      find: () => Promise.resolve(stored),
      nextDueGrading: () => Promise.resolve(null),
      of: () => Promise.resolve(stored),
      add: (answer: QuestionAnswer) => {
        if (over.answeredMeanwhile && !stored) {
          stored = over.answeredMeanwhile;
          return Promise.reject(
            new QuestionAnswerVersionConflictError(answer.id.value),
          );
        }
        if (over.takenOnTask && !taken) {
          taken = over.takenOnTask;
          return Promise.reject(
            new QuestionAnswerVersionConflictError(answer.id.value),
          );
        }
        added.push(answer);
        return Promise.resolve();
      },
      save: (answer: QuestionAnswer) => {
        if (over.takenOnSave && !taken) {
          taken = over.takenOnSave;
          return Promise.reject(
            new QuestionAnswerVersionConflictError(answer.id.value),
          );
        }
        saved.push(answer);
        return Promise.resolve();
      },
      ofTask: () => Promise.resolve(over.inTask ?? []),
      ofTaskBy: () =>
        Promise.resolve(
          over.inTask ?? [
            ...(stored ? [stored] : []),
            ...(taken ? [taken] : []),
          ],
        ),
      ofTeam: () => Promise.resolve([]),
      remove: async () => {},
    } satisfies QuestionAnswerRepository,
    { generate: () => 'answer-1' },
    { now: () => NOW, sleep: async () => {} },
  );

  return { handler, added, saved };
};

const answer = (reply: string | null, questionId = 'c1.l1.q1') =>
  new AnswerQuestionCommand('team_1', 'stack-1', questionId, 'user-1', reply);

describe('AnswerQuestionHandler', () => {
  it('saves an answer in words with the expected answer, to be graded after', async () => {
    const { handler, added } = answering();

    await handler.execute(answer(' The bot signs it. '));

    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      questionId: 'c1.l1.q1',
      reply: 'The bot signs it.',
      grading: 'pending',
      verdict: null,
      feedback: null,
      expected: 'The integration signs it.',
    });
    expect(added[0]?.hasPendingJob).toBe(true);
  });

  it('counts the answer as missed at once when the reviewer does not know', async () => {
    const { handler, added } = answering();

    await handler.execute(answer(null));

    expect(added[0]?.grading).toBe('graded');
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
      answeredMeanwhile: before[0],
    });

    await expect(handler.execute(answer(null))).rejects.toMatchObject({
      kind: 'conflict',
      message: 'You already answered this question.',
    });
    expect(added).toEqual([]);
  });

  it('refuses the second answer when one given meanwhile on another stack of the task took the key', async () => {
    const { handler: first, added: before } = answering();
    await first.execute(answer(null));

    const { handler, added } = answering({ takenOnTask: before[0] });

    await expect(handler.execute(answer(null))).rejects.toMatchObject({
      kind: 'conflict',
      message: 'You already answered this question.',
    });
    expect(added).toEqual([]);
  });

  it('answers again, on the same answer, a question the stack asks in other words since it was redrafted', async () => {
    const { handler: first, added: before } = answering();
    await first.execute(answer(null));
    const stale = before[0];
    Object.defineProperty(stale, 'asked', { value: 'An older question?' });

    const { handler, added, saved } = answering({ earlier: stale });
    await handler.execute(answer(null));

    expect(added).toEqual([]);
    expect(saved[0]?.id).toEqual(stale.id);
    expect(saved[0]?.asked).toBe('Who signs when the member has left?');
  });

  it('refuses a reply too long', async () => {
    const { handler, added } = answering();

    await expect(
      handler.execute(answer('x'.repeat(4_001))),
    ).rejects.toMatchObject({ kind: 'invalid' });
    expect(added).toEqual([]);
  });

  it('refuses a workspace member outside the team, and records nothing', async () => {
    const { handler, added, saved } = answering({ onTeam: false });

    await expect(
      handler.execute(answer('The integration.')),
    ).rejects.toMatchObject({
      refusal: expect.any(TeamMembershipRequiredError) as unknown,
    });
    expect(added).toEqual([]);
    expect(saved).toEqual([]);
  });

  it('hides a stack the caller cannot see, and a question the stack does not ask', async () => {
    await expect(
      answering({ seen: false }).handler.execute(answer(null)),
    ).rejects.toMatchObject({ kind: 'not-found' });
    await expect(
      answering().handler.execute(answer(null, 'c1.l1.q2')),
    ).rejects.toMatchObject({ kind: 'not-found' });
    await expect(
      answering().handler.execute(answer(null, 'not-a-question')),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('refuses an answer again when one given meanwhile on another stack took the key while it answered anew', async () => {
    const { handler: first, added: before } = answering();
    await first.execute(answer(null));
    const stale = before[0];
    Object.defineProperty(stale, 'asked', { value: 'An older question?' });
    const { handler: other, added: given } = answering();
    await other.execute(answer(null));

    const { handler, saved } = answering({
      earlier: stale,
      takenOnSave: given[0],
    });

    await expect(handler.execute(answer(null))).rejects.toMatchObject({
      kind: 'conflict',
      message: 'You already answered this question.',
    });
    expect(saved).toEqual([]);
  });

  it('refuses an answer the reviewer already gave on the task’s earlier stack', async () => {
    const { handler: first, added: before } = answering();
    await first.execute(answer(null));

    const { handler, added } = answering({ inTask: before });

    await expect(handler.execute(answer(null))).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(added).toEqual([]);
  });

  it('takes a new answer once the earlier stack expected another answer', async () => {
    const { handler: first, added: before } = answering();
    await first.execute(answer(null));
    const outdated = before[0];
    Object.defineProperty(outdated, 'expected', { value: 'The bot signs it.' });

    const { handler, added } = answering({ inTask: [outdated] });
    await handler.execute(answer(null));

    expect(added[0]?.expected).toBe('The integration signs it.');
  });

  describe('for a stack a person pushed, with no run', () => {
    const PUSHED = StackOrigin.push(commitSha('b'), Pusher.of('octocat'));
    const TASK: ReviewedTask = {
      id: TaskId.of('task-1'),
      workspaceId: WorkspaceId.of('workspace-1'),
      teamId: TeamId.of('team_1'),
      pullRequests: [],
      openPullRequests: [],
      reviewedPullRequest: null,
      reviewing: false,
      currentRunId: null,
    };
    const accessTo = (task: ReviewedTask | null, actsOnTeam = true) => {
      const run = vi.fn(() => Promise.resolve(null));

      return {
        run,
        access: new TeamWorkAccess(
          {
            viewerOf: () =>
              Promise.resolve({
                workspaceId: WorkspaceId.of('workspace-1'),
                teamId: TeamId.of('team_1'),
                by: UserId.of('user-1'),
              }),
            actsOnTeam: () => Promise.resolve(actsOnTeam),
            find: () => Promise.resolve(null),
          },
          partial<WorkPort>({
            run,
            task: () => Promise.resolve(task),
            teamOfRun: () => Promise.resolve(null),
          }),
        ),
      };
    };

    it('lets a member of the task’s team answer, without asking for a run', async () => {
      const { access, run } = accessTo(TASK);
      const { handler, added } = answering({
        stack: asking(undefined, PUSHED),
        access,
      });

      await handler.execute(answer(null));

      expect(added).toHaveLength(1);
      expect(added[0]?.stackId).toEqual(ChangeStackId.of('stack-1'));
      expect(run).not.toHaveBeenCalled();
    });

    it('hides it from someone who does not see the task, and refuses an outsider', async () => {
      await expect(
        answering({
          stack: asking(undefined, PUSHED),
          access: accessTo(null).access,
        }).handler.execute(answer(null)),
      ).rejects.toMatchObject({ kind: 'not-found' });
      await expect(
        answering({
          stack: asking(undefined, PUSHED),
          access: accessTo({ ...TASK, teamId: TeamId.of('team_2') }).access,
        }).handler.execute(answer(null)),
      ).rejects.toMatchObject({ kind: 'not-found' });
      await expect(
        answering({
          stack: asking(undefined, PUSHED),
          access: accessTo(TASK, false).access,
        }).handler.execute(answer(null)),
      ).rejects.toMatchObject({
        refusal: expect.any(TeamMembershipRequiredError) as unknown,
      });
    });
  });
});
