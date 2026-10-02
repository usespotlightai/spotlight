import type { ConfigPullRequestDto } from '@replays/application/dto/config-pull-requests.dto';
import type { ReadConfigPullRequestQuery } from '@replays/application/queries/read-config-pull-request.query';
import { configPullRequestView } from '@replays/application/services/config-pull-request-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { UnknownConfigPullRequestError } from '@replays/domain/exceptions/unknown-config-pull-request.error';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadConfigPullRequestHandler
  implements QueryHandlerPort<ReadConfigPullRequestQuery, ConfigPullRequestDto>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly pullRequests: ConfigPullRequestRepository,
  ) {}

  async execute(
    query: ReadConfigPullRequestQuery,
  ): Promise<ConfigPullRequestDto> {
    try {
      const clearance = await this.access.clearance(
        query.teamId,
        query.principal,
      );
      const pullRequest = await this.pullRequests.find(
        ConfigPullRequestId.of(query.pullRequestId),
      );

      if (!pullRequest || !clearance.sees(pullRequest.station)) {
        throw new UnknownConfigPullRequestError(query.pullRequestId);
      }

      return configPullRequestView(pullRequest);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
