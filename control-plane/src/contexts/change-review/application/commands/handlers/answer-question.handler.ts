import type { AnswerQuestionCommand } from '@change-review/application/commands/answer-question.command';
import { ChangeStacksUnavailableError } from '@change-review/application/errors/change-stacks-unavailable.error';
import type { AnswerGraderPort } from '@change-review/application/ports/answer-grader.port';
import type { TeamWorkAccess } from '@change-review/application/services/team-work-access.service';
import { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';
import { QuestionAnswerVersionConflictError } from '@change-review/domain/exceptions/question-answer-version-conflict.error';
import { UnknownChangeStackError } from '@change-review/domain/exceptions/unknown-change-stack.error';
import { UnknownQuestionError } from '@change-review/domain/exceptions/unknown-question.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { QuestionAnswerRepository } from '@change-review/domain/repositories/question-answer.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
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
    private readonly grader: AnswerGraderPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: AnswerQuestionCommand): Promise<void> {
    try {
      const unknownStack = () =>
        new UnknownChangeStackError(
          `Change stack ${command.stackId} not found.`,
        );
      const run = await this.access.actingOnRun(
        command.teamId,
        command.runId,
        command.viewerId,
        unknownStack,
      );
      const stack = await this.stacks.find(ChangeStackId.of(command.stackId));

      if (!stack?.runId.equals(run.id)) {
        throw unknownStack();
      }

      const question = stack.question(questionIdOf(command.questionId));
      const personId = UserId.of(command.viewerId);
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

      const reply = QuestionAnswer.replyOf(command.reply);

      if (reply && !(await this.grader.availableTo(run.workspaceId.value))) {
        throw new ChangeStacksUnavailableError();
      }

      const graded = reply
        ? await this.grader.grade({
            workspaceId: run.workspaceId.value,
            question: question.question,
            expected: question.answer,
            reply,
            cited: stack.citedBy(question),
          })
        : null;
      const now = this.clock.now();

      for (let attempt = 1, stored = earlier; ; attempt += 1) {
        stored?.refuseIfAnswered(question);

        try {
          if (stored) {
            await this.answers.save(
              stored.answeredAgain({ question, reply, graded, now }),
            );
          } else {
            await this.answers.add(
              QuestionAnswer.given({
                id: QuestionAnswerId.of(this.ids.generate()),
                stack,
                question,
                personId,
                reply,
                graded,
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

        stored = await this.answers.of(stack.id, question.id, personId);
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
