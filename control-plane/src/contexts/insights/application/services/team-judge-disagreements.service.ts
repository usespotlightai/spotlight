import type { InsightsAccess } from '@insights/application/services/insights-access.service';
import type { JudgeDisagreement } from '@insights/domain/aggregates/judge-disagreement.aggregate';
import { UnknownJudgeDisagreementError } from '@insights/domain/exceptions/unknown-judge-disagreement.error';
import type { JudgeDisagreementRepository } from '@insights/domain/repositories/judge-disagreement.repository';
import { JudgeDisagreementId } from '@insights/domain/value-objects/judge-disagreement-id.vo';
import type { ViewedTeam } from '@insights/domain/value-objects/viewed-team.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface DisagreementOnTeam {
  readonly access: ViewedTeam;
  readonly disagreement: JudgeDisagreement;
}

export class TeamJudgeDisagreements {
  constructor(
    private readonly access: InsightsAccess,
    private readonly disagreements: JudgeDisagreementRepository,
  ) {}

  async onTeam(input: {
    teamId: string;
    disagreementId: string;
    viewerId: string;
  }): Promise<DisagreementOnTeam> {
    const access = await this.access.forTeam(
      TeamId.of(input.teamId),
      UserId.of(input.viewerId),
    );
    const disagreement = await this.disagreements.find(
      JudgeDisagreementId.of(input.disagreementId),
    );

    if (
      !disagreement ||
      !access.covers(disagreement.workspaceId, disagreement.location.teamId)
    ) {
      throw new UnknownJudgeDisagreementError(input.disagreementId);
    }

    return { access, disagreement };
  }
}
