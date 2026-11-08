import { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';
import { QuestionAnswerVersionConflictError } from '@change-review/domain/exceptions/question-answer-version-conflict.error';
import type { QuestionAnswerRepository } from '@change-review/domain/repositories/question-answer.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { QuestionId } from '@change-review/domain/value-objects/stack-ids';
import { questionAnswer } from '@change-review/infrastructure/persistence/drizzle/schemas/question-answer.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

const isAnswerTaken = (error: unknown): boolean =>
  violates(error, UNIQUE_VIOLATION, 'question_answer_person_idx');

type Row = typeof questionAnswer.$inferSelect;

const toAnswer = (row: Row): QuestionAnswer =>
  QuestionAnswer.rehydrate({
    id: QuestionAnswerId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    taskId: row.taskId ? TaskId.of(row.taskId) : null,
    teamId: row.teamId ? TeamId.of(row.teamId) : null,
    stackId: ChangeStackId.of(row.stackId),
    repository: row.repository ? RepositoryName.of(row.repository) : null,
    questionId: QuestionId.of(row.questionId),
    personId: UserId.of(row.personId),
    asked: row.asked,
    expected: row.expected,
    reply: row.reply,
    verdict: row.verdict,
    feedback: row.feedback,
    usage: ModelUsage.rehydrate(row.usage),
    answeredAt: row.answeredAt,
    version: row.version,
  });

const toRow = (answer: QuestionAnswer): Row => ({
  id: answer.id.value,
  workspaceId: answer.workspaceId.value,
  taskId: answer.taskId?.value ?? null,
  teamId: answer.teamId?.value ?? null,
  stackId: answer.stackId.value,
  repository: answer.repository?.value ?? null,
  questionId: answer.questionId,
  personId: answer.personId.value,
  asked: answer.asked,
  expected: answer.expected,
  reply: answer.reply,
  verdict: answer.verdict,
  feedback: answer.feedback,
  usage: {
    calls: answer.usage.calls,
    inputTokens: answer.usage.inputTokens,
    outputTokens: answer.usage.outputTokens,
    costs: answer.usage.costs.map((each) => ({ ...each })),
    unpriced: answer.usage.unpriced,
  },
  answeredAt: answer.answeredAt,
  version: answer.version,
});

@Injectable()
export class DrizzleQuestionAnswerRepository
  implements QuestionAnswerRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: QuestionAnswer): Promise<void> {
    await this.context.inTransaction(async () => {
      try {
        await this.context.db.insert(questionAnswer).values(toRow(added));
      } catch (error) {
        throw isAnswerTaken(error)
          ? new QuestionAnswerVersionConflictError(added.id.value)
          : error;
      }
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: QuestionAnswer): Promise<void> {
    await this.context.inTransaction(async () => {
      const { id, version, ...changed } = toRow(saved);

      const written = await this.context.db
        .update(questionAnswer)
        .set({ ...changed, version: version + 1 })
        .where(
          and(eq(questionAnswer.id, id), eq(questionAnswer.version, version)),
        )
        .returning({ id: questionAnswer.id });

      if (written.length === 0) {
        throw new QuestionAnswerVersionConflictError(id);
      }
      await this.events.dispatch(saved.pullEvents());
    });
  }

  async of(
    stackId: ChangeStackId,
    questionId: QuestionId,
    personId: UserId,
  ): Promise<QuestionAnswer | null> {
    const [row] = await this.context.db
      .select()
      .from(questionAnswer)
      .where(
        and(
          eq(questionAnswer.stackId, stackId.value),
          eq(questionAnswer.questionId, questionId),
          eq(questionAnswer.personId, personId.value),
        ),
      )
      .limit(1);

    return row ? toAnswer(row) : null;
  }

  async ofTask(taskId: TaskId): Promise<readonly QuestionAnswer[]> {
    const rows = await this.context.db
      .select()
      .from(questionAnswer)
      .where(eq(questionAnswer.taskId, taskId.value));

    return rows.map(toAnswer);
  }

  async ofTaskBy(
    taskId: TaskId,
    personId: UserId,
  ): Promise<readonly QuestionAnswer[]> {
    const rows = await this.context.db
      .select()
      .from(questionAnswer)
      .where(
        and(
          eq(questionAnswer.taskId, taskId.value),
          eq(questionAnswer.personId, personId.value),
        ),
      );

    return rows.map(toAnswer);
  }

  async ofTeam(teamId: TeamId): Promise<readonly QuestionAnswer[]> {
    const rows = await this.context.db
      .select()
      .from(questionAnswer)
      .where(eq(questionAnswer.teamId, teamId.value));

    return rows.map(toAnswer);
  }

  async remove(removed: QuestionAnswer): Promise<void> {
    await this.context.inTransaction(async () => {
      const deleted = await this.context.db
        .delete(questionAnswer)
        .where(
          and(
            eq(questionAnswer.id, removed.id.value),
            eq(questionAnswer.version, removed.version),
          ),
        )
        .returning({ id: questionAnswer.id });

      if (deleted.length === 0) {
        throw new QuestionAnswerVersionConflictError(removed.id.value);
      }

      await this.events.dispatch(removed.pullEvents());
    });
  }
}
