import { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';
import { QuestionAlreadyAnsweredError } from '@change-review/domain/exceptions/question-already-answered.error';
import { QuestionAnswerVersionConflictError } from '@change-review/domain/exceptions/question-answer-version-conflict.error';
import type { QuestionAnswerRepository } from '@change-review/domain/repositories/question-answer.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import { QuestionId } from '@change-review/domain/value-objects/stack-ids';
import { questionAnswer } from '@change-review/infrastructure/persistence/drizzle/schemas/question-answer.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

const UNIQUE_VIOLATION = '23505';

const isAnsweredTwice = (error: unknown): boolean => {
  const raised = ((error as { cause?: unknown } | null)?.cause ?? error) as {
    code?: string;
  } | null;

  return raised?.code === UNIQUE_VIOLATION;
};

type Row = typeof questionAnswer.$inferSelect;

const toAnswer = (row: Row): QuestionAnswer =>
  QuestionAnswer.rehydrate({
    id: QuestionAnswerId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    stackId: ChangeStackId.of(row.stackId),
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
  stackId: answer.stackId.value,
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
        throw isAnsweredTwice(error)
          ? new QuestionAlreadyAnsweredError()
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
}
