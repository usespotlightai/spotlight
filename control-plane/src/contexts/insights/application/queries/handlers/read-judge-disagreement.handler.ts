import {
  type JudgeDisagreementDto,
  judgeDisagreementDtoOf,
} from '@insights/application/dto/judge-disagreement.dto';
import type { ReadJudgeDisagreementQuery } from '@insights/application/queries/read-judge-disagreement.query';
import type { TeamJudgeDisagreements } from '@insights/application/services/team-judge-disagreements.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadJudgeDisagreementHandler implements QueryHandlerPort<
  ReadJudgeDisagreementQuery,
  JudgeDisagreementDto
> {
  constructor(private readonly disagreements: TeamJudgeDisagreements) {}

  async execute(
    query: ReadJudgeDisagreementQuery,
  ): Promise<JudgeDisagreementDto> {
    try {
      const { disagreement } = await this.disagreements.onTeam(query);

      return judgeDisagreementDtoOf(disagreement);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
