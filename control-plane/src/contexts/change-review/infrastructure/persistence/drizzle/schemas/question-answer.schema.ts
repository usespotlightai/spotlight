import {
  ANSWER_GRADINGS,
  type AnswerGrading,
} from '@change-review/domain/value-objects/answer-grading.vo';
import {
  ANSWER_VERDICTS,
  type AnswerVerdict,
} from '@change-review/domain/value-objects/answer-verdict.vo';
import type { StoredModelUsage } from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.schema';
import { timestamptz } from '@platform/persistence/drizzle/columns';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const answerVerdict = pgEnum('answer_verdict', ANSWER_VERDICTS);

export const answerGrading = pgEnum('answer_grading', ANSWER_GRADINGS);

export const questionAnswer = pgTable(
  'question_answer',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id'),
    teamId: text('team_id'),
    stackId: text('stack_id').notNull(),
    repository: text('repository'),
    questionId: text('question_id').notNull(),
    personId: text('person_id').notNull(),
    asked: text('asked').notNull(),
    expected: text('expected').notNull(),
    reply: text('reply'),
    grading: answerGrading('grading')
      .$type<AnswerGrading>()
      .notNull()
      .default('graded'),
    verdict: answerVerdict('verdict').$type<AnswerVerdict>(),
    feedback: text('feedback'),
    usage: jsonb('usage').$type<StoredModelUsage>().notNull(),
    jobAttempts: integer('job_attempts').notNull().default(0),
    jobDueAt: timestamptz('job_due_at'),
    waitingSince: timestamptz('waiting_since'),
    answeredAt: timestamptz('answered_at').notNull(),
    version: integer('version').notNull(),
  },
  (table) => [
    uniqueIndex('question_answer_person_idx').on(
      table.stackId,
      table.personId,
      table.questionId,
    ),
    uniqueIndex('question_answer_task_question_idx')
      .on(
        table.taskId,
        sql`lower(coalesce(${table.repository}, ''))`,
        table.personId,
        sql`md5(${table.asked})`,
        sql`md5(${table.expected})`,
      )
      .where(sql`${table.taskId} is not null`),
    index('question_answer_task_idx').on(table.taskId),
    index('question_answer_team_idx').on(table.teamId),
    index('question_answer_grading_job_idx')
      .on(table.jobDueAt)
      .where(sql`${table.grading} = 'pending'`),
    check(
      'question_answer_job_attempts_not_negative',
      sql`${table.jobAttempts} >= 0`,
    ),
    check(
      'question_answer_verdict_once_graded',
      sql`(${table.grading} = 'graded') = (${table.verdict} IS NOT NULL)`,
    ),
    check(
      'question_answer_reply_or_missed',
      sql`${table.reply} IS NOT NULL OR (${table.grading} = 'graded' AND ${table.verdict} = 'missed')`,
    ),
  ],
);
