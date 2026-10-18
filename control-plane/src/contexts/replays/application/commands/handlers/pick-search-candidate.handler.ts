import type { PickSearchCandidateCommand } from '@replays/application/commands/pick-search-candidate.command';
import type { CandidatePicked } from '@replays/application/dto/replay-outcomes.dto';
import type { WorkPort } from '@replays/application/ports/work.port';
import { configPullRequestView } from '@replays/application/services/config-pull-request-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import { UnknownStationError } from '@replays/domain/exceptions/unknown-station.error';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import { pickedFrom } from '@replays/domain/services/search-picks';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

export class PickSearchCandidateHandler
  implements CommandHandlerPort<PickSearchCandidateCommand, CandidatePicked>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly work: WorkPort,
    private readonly pullRequests: ConfigPullRequestRepository,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: PickSearchCandidateCommand): Promise<CandidatePicked> {
    try {
      const access = await this.access.forTeam(
        command.teamId,
        command.actor.principal,
      );
      const search = await this.access.searchOn(access, command.searchId);

      if (!access.mayPlan) {
        return forbiddenTo('plan');
      }

      const proposal = pickedFrom(search, CandidateId.of(command.candidateId));
      const existing = await this.pullRequests.forCandidate(
        search.id,
        proposal.candidateId,
      );

      if (existing && !existing.isRetryable) {
        return {
          outcome: 'already',
          pullRequest: configPullRequestView(existing),
        };
      }

      const station = await this.work.station(
        search.station.lineId,
        search.station.stationId,
      );

      if (!station) {
        throw new UnknownStationError(search.station.stationId);
      }

      const by = ChangeActor.of(command.actor, search.workspaceId);
      const at = this.clock.now();

      if (existing) {
        const retried = existing.retried({
          lineKey: station.lineKey,
          source: station.source,
          at,
          by,
        });

        await this.transaction.inTransaction(() =>
          this.pullRequests.save(retried),
        );

        return {
          outcome: 'picked',
          pullRequest: configPullRequestView(retried),
        };
      }

      const fresh = ConfigPullRequest.pick({
        id: ConfigPullRequestId.of(this.ids.generate()),
        searchId: search.id,
        candidateId: proposal.candidateId,
        station: search.station,
        stationKey: station.key,
        candidateName: proposal.name.value,
        lineKey: station.lineKey,
        source: station.source,
        at,
        by,
      });
      const stored = await this.transaction.inTransaction(() =>
        this.pullRequests.add(fresh),
      );

      return {
        outcome: stored.id.equals(fresh.id) ? 'picked' : 'already',
        pullRequest: configPullRequestView(stored),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
