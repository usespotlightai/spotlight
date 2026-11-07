import type { QuestionAnswerDto } from '@change-review/application/dto/change-stack.dto';
import type { ChangeStackReaderPort } from '@change-review/application/ports/change-stack-reader.port';
import type { ReadQuestionAnswerQuery } from '@change-review/application/queries/read-question-answer.query';
import type { TeamWorkAccess } from '@change-review/application/services/team-work-access.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ReadQuestionAnswerHandler
  implements QueryHandlerPort<ReadQuestionAnswerQuery, QuestionAnswerDto | null>
{
  constructor(
    private readonly access: TeamWorkAccess,
    private readonly stacks: ChangeStackReaderPort,
  ) {}

  async execute(
    query: ReadQuestionAnswerQuery,
  ): Promise<QuestionAnswerDto | null> {
    try {
      const run = await this.access.run(
        query.teamId,
        query.runId,
        query.viewerId,
      );

      return run
        ? await this.stacks.answerOf(
            run.id,
            query.stackId,
            query.questionId,
            UserId.of(query.viewerId),
          )
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
