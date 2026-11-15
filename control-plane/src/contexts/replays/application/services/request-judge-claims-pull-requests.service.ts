import { JudgeClaimsPullRequest } from '@replays/domain/aggregates/judge-claims-pull-request.aggregate';
import type { ProposedStation } from '@replays/domain/aggregates/judge-claims-pull-request.aggregate';
import { JudgeClaimsPullRequestVersionConflictError } from '@replays/domain/exceptions/judge-claims-pull-request-version-conflict.error';
import type { JudgeClaimsPullRequestRepository } from '@replays/domain/repositories/judge-claims-pull-request.repository';
import type { JudgeClaimsProposal } from '@replays/domain/value-objects/judge-claims-proposal';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class RequestJudgeClaimsPullRequests {
  constructor(
    private readonly pullRequests: JudgeClaimsPullRequestRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async request(input: {
    revisionId: string;
    station: ProposedStation;
    proposal: JudgeClaimsProposal;
  }): Promise<void> {
    try {
      await this.transaction.inTransaction(async () => {
        if (await this.pullRequests.find(input.revisionId)) {
          return;
        }

        await this.pullRequests.add(
          JudgeClaimsPullRequest.requested({ ...input, now: this.clock.now() }),
        );
      });
    } catch (error) {
      if (error instanceof JudgeClaimsPullRequestVersionConflictError) {
        return;
      }
      throw error;
    }
  }

  async ofTeam(teamId: TeamId): Promise<void> {
    for (const each of await this.pullRequests.ofTeam(teamId)) {
      await this.transaction.inTransaction(() =>
        this.pullRequests.save(each.delete()),
      );
    }
  }
}
