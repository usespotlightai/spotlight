import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';
import { QuestionAnswerVersionConflictError } from '@change-review/domain/exceptions/question-answer-version-conflict.error';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import {
  HunkId,
  QuestionId,
} from '@change-review/domain/value-objects/stack-ids';
import { DrizzleChangeStackReader } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.reader';
import { DrizzleChangeStackRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.repository';
import { DrizzleQuestionAnswerRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/question-answer.repository';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';

const NOW = new Date('2026-11-02T10:00:00.000Z');
const RUN = RunId.of('run_1');
const ADA = UserId.of('user_ada');
const BEA = UserId.of('user_bea');

const EVENTS = {
  dispatch: async () => {},
} as unknown as DomainEventDispatcher;

let database: TestDatabase;
let stacks: DrizzleChangeStackRepository;
let answers: DrizzleQuestionAnswerRepository;
let reader: DrizzleChangeStackReader;

const ready = ChangeStack.startGeneration({
  id: ChangeStackId.of('stack_1'),
  runId: RUN,
  taskId: TaskId.of('task_1'),
  teamOfRun: null,
  trial: false,
  checkouts: 1,
  workspaceId: WorkspaceId.of('ws_1'),
  repository: null,
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
          patch: '@@ -1 +1 @@\n-bot\n+member ?? integration',
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
          hunks: [{ hunk: HunkId.of('h1') }],
          notes: [{ path: 'slack.ts', note: 'Picks the signer' }],
          questions: [
            {
              question: 'Who signs when the member has left?',
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

const question = ready.question(QuestionId.of('c1.l1.q1'));

const answered = (id: string, personId: UserId, asked = question) =>
  QuestionAnswer.given({
    id: QuestionAnswerId.of(id),
    stack: ready,
    question: asked,
    personId,
    reply: 'The bot.',
    graded: {
      grade: { verdict: 'missed', feedback: 'The integration signs it.' },
      usage: { inputTokens: 200, outputTokens: 30, cost: null },
    },
    now: NOW,
  });

const questionsFor = async (viewer: UserId) => {
  const [stack] = await reader.ofRun(RUN, viewer, NOW);
  return stack?.cohorts[0]?.layers[0]?.questions;
};

beforeAll(async () => {
  database = await openDatabase('question_answers');
  const context = new DrizzleContext(database.db);
  stacks = new DrizzleChangeStackRepository(context, EVENTS);
  answers = new DrizzleQuestionAnswerRepository(context, EVENTS);
  reader = new DrizzleChangeStackReader(context);
  await stacks.add(ready);
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('answers to the questions of a change stack', () => {
  it('shows a question without its expected answer to a reviewer who has not answered', async () => {
    expect(await questionsFor(ADA)).toEqual([
      {
        id: 'c1.l1.q1',
        question: 'Who signs when the member has left?',
        hunks: ['h1'],
        answered: null,
      },
    ]);
  });

  it('shows each reviewer only their own answer, with the expected answer', async () => {
    await answers.add(answered('answer_ada', ADA));

    expect((await questionsFor(ADA))?.[0]?.answered).toEqual({
      questionId: 'c1.l1.q1',
      reply: 'The bot.',
      verdict: 'missed',
      feedback: 'The integration signs it.',
      expected: 'The integration signs it.',
      outdated: false,
    });
    expect((await questionsFor(BEA))?.[0]?.answered).toBeNull();

    const found = await answers.of(ready.id, question.id, ADA);
    expect(found?.usage.inputTokens).toBe(200);
  });

  it('refuses a second answer by the same reviewer as a version conflict, for the caller to decide again', async () => {
    await expect(answers.add(answered('answer_ada_2', ADA))).rejects.toThrow(
      QuestionAnswerVersionConflictError,
    );
  });

  it('shows no answer to a question asked in other words since', async () => {
    await answers.add(
      answered('answer_bea', BEA, { ...question, question: 'Who signed?' }),
    );

    expect((await questionsFor(BEA))?.[0]?.answered).toBeNull();
  });

  it('finds the answers of a task and removes each, whether or not its change stack is still there', async () => {
    await database.db.execute(
      sql`delete from change_stack where id = 'stack_1'`,
    );
    for (const each of await answers.ofTask(TaskId.of('task_1'))) {
      await answers.remove(each);
    }

    const [{ count } = { count: -1 }] = (
      await database.db.execute<{ count: number }>(
        sql`select count(*)::int as count from question_answer`,
      )
    ).rows;
    expect(count).toBe(0);
  });
});
