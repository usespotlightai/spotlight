import type { AnswerQuestionCommand } from '@change-review/application/commands/answer-question.command';
import type { QuestionAnswerDto } from '@change-review/application/dto/change-stack.dto';
import { questionAnswerDtoOf } from '@change-review/application/mappers/question-answer.to-dto';
import type { AnswerGraderPort } from '@change-review/application/ports/answer-grader.port';
import type { ChangeStackAccess } from '@change-review/application/services/change-stack-access.service';
import { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';
import { ChangeStacksUnavailableError } from '@change-review/domain/exceptions/change-stacks-unavailable.error';
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

const questionIdOf = (raw: string): QuestionId => {
  try {
    return QuestionId.of(raw);
  } catch {
    throw new UnknownQuestionError();
  }
};

export class AnswerQuestionHandler
  implements CommandHandlerPort<AnswerQuestionCommand, QuestionAnswerDto>
{
  constructor(
    private readonly access: ChangeStackAccess,
    private readonly stacks: ChangeStackRepository,
    private readonly answers: QuestionAnswerRepository,
    private readonly grader: AnswerGraderPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: AnswerQuestionCommand): Promise<QuestionAnswerDto> {
    try {
      const run = await this.access.ofRun(
        command.teamId,
        command.runId,
        command.viewerId,
      );
      const stack = run
        ? await this.stacks.find(ChangeStackId.of(command.stackId))
        : null;

      if (!run || !stack?.runId.equals(run.id)) {
        throw new UnknownChangeStackError(
          `Change stack ${command.stackId} not found.`,
        );
      }

      const question = stack.question(questionIdOf(command.questionId));
      const personId = UserId.of(command.viewerId);
      const earlier = await this.answers.of(stack.id, question.id, personId);
      earlier?.refuseIfAnswered(question);

      const reply = QuestionAnswer.replyOf(command.reply);

      if (reply && !this.grader.available) {
        throw new ChangeStacksUnavailableError();
      }

      const graded = reply
        ? await this.grader.grade({
            question: question.question,
            expected: question.answer,
            reply,
            cited: stack.citedBy(question),
          })
        : null;
      const now = this.clock.now();

      const answer = earlier
        ? earlier.answeredAgain({ question, reply, graded, now })
        : QuestionAnswer.given({
            id: QuestionAnswerId.of(this.ids.generate()),
            workspaceId: stack.workspaceId,
            stackId: stack.id,
            question,
            personId,
            reply,
            graded,
            now,
          });

      await (earlier ? this.answers.save(answer) : this.answers.add(answer));

      return questionAnswerDtoOf(answer);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
