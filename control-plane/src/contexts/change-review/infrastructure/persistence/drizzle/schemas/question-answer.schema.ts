import {
  ANSWER_VERDICTS,
  type AnswerVerdict,
} from '@change-review/domain/aggregates/question-answer.aggregate';
import type { StoredModelUsage } from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.schema';
import { timestamptz } from '@platform/persistence/drizzle/columns';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const answerVerdict = pgEnum('answer_verdict', ANSWER_VERDICTS);

export const questionAnswer = pgTable(
  'question_answer',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id'),
    stackId: text('stack_id').notNull(),
    questionId: text('question_id').notNull(),
    personId: text('person_id').notNull(),
    asked: text('asked').notNull(),
    expected: text('expected').notNull(),
    reply: text('reply'),
    verdict: answerVerdict('verdict').$type<AnswerVerdict>().notNull(),
    feedback: text('feedback'),
    usage: jsonb('usage').$type<StoredModelUsage>().notNull(),
    answeredAt: timestamptz('answered_at').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('question_answer_person_idx').on(
      table.stackId,
      table.personId,
      table.questionId,
    ),
    index('question_answer_task_idx').on(table.taskId),
  ],
);
