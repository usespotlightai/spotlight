import type { AnswerQuestionCommand } from '@change-review/application/commands/answer-question.command';
import type { TeamWorkAccess } from '@change-review/application/services/team-work-access.service';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';
import { QuestionAnswerVersionConflictError } from '@change-review/domain/exceptions/question-answer-version-conflict.error';
import { UnknownChangeStackError } from '@change-review/domain/exceptions/unknown-change-stack.error';
import { UnknownQuestionError } from '@change-review/domain/exceptions/unknown-question.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { QuestionAnswerRepository } from '@change-review/domain/repositories/question-answer.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import type { LayerQuestion } from '@change-review/domain/value-objects/stack-cohort.vo';
import { QuestionId } from '@change-review/domain/value-objects/stack-ids';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const ATTEMPTS = 3;

const questionIdOf = (raw: string): QuestionId => {
  const parsed = QuestionId.parsed(raw);

  if (!parsed) {
    throw new UnknownQuestionError();
  }

  return parsed;
};

export class AnswerQuestionHandler implements CommandHandlerPort<
  AnswerQuestionCommand,
  void
> {
  constructor(
    private readonly access: TeamWorkAccess,
    private readonly stacks: ChangeStackRepository,
    private readonly answers: QuestionAnswerRepository,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: AnswerQuestionCommand): Promise<void> {
    try {
      const unknownStack = () =>
        new UnknownChangeStackError(
          `Change stack ${command.stackId} not found.`,
        );
      const stack = await this.stacks.find(ChangeStackId.of(command.stackId));

      if (!stack) {
        throw unknownStack();
      }

      await this.access.actingOnStack(
        command.teamId,
        stack.visibility,
        command.viewerId,
        unknownStack,
      );

      const question = stack.question(questionIdOf(command.questionId));
      const personId = UserId.of(command.viewerId);
      const earlier = await this.unanswered(stack, question, personId);
      const { reply } = command;
      const now = this.clock.now();

      for (let attempt = 1, stored = earlier; ; attempt += 1) {
        try {
          if (stored) {
            await this.answers.save(
              stored.answeredAgain({ question, reply, now }),
            );
          } else {
            await this.answers.add(
              QuestionAnswer.given({
                id: QuestionAnswerId.of(this.ids.generate()),
                stack,
                question,
                personId,
                reply,
                now,
              }),
            );
          }
          return;
        } catch (error) {
          if (
            !(error instanceof QuestionAnswerVersionConflictError) ||
            attempt >= ATTEMPTS
          ) {
            throw error;
          }
        }

        stored = await this.unanswered(stack, question, personId);
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async unanswered(
    stack: ChangeStack,
    question: LayerQuestion,
    personId: UserId,
  ): Promise<QuestionAnswer | null> {
    const earlier = await this.answers.of(stack.id, question.id, personId);

    QuestionAnswer.refuseIfAnsweredIn(
      stack.taskId
        ? await this.answers.ofTaskBy(stack.taskId, personId)
        : earlier
          ? [earlier]
          : [],
      question,
      stack,
    );

    return earlier;
  }
}
