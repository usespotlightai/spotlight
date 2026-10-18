import { Get, HttpStatus, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import {
  ApiProblemResponse,
  ConventionalApiController,
} from '@platform/http/resources/conventional-api';
import type { ConfigPullRequestDto } from '@replays/application/dto/config-pull-requests.dto';
import { ReadConfigPullRequestQuery } from '@replays/application/queries/read-config-pull-request.query';
import { ConfigPullRequestResponseDto } from '@replays/presentation/http/dto/config-pull-requests.response.dto';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

@ConventionalApiController('teams/:teamId', 'replays')
@ApiParam({ name: 'teamId', type: String })
@ApiProblemResponse(
  HttpStatus.NOT_FOUND,
  'No such team or config pull request for this caller',
)
export class ConfigPullRequestsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('config-pull-requests/:pullRequestId')
  @ApiOperation({
    operationId: 'readConfigPullRequest',
    summary:
      'Read the pull request a picked search candidate opens in the line’s config repository: opening, opened with its link, or failed and why',
  })
  @ApiParam({ name: 'pullRequestId', type: String })
  @ApiOkResponse({ type: ConfigPullRequestResponseDto })
  async read(
    @Param('teamId') teamId: string,
    @Param('pullRequestId') pullRequestId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ConfigPullRequestResponseDto> {
    return new ConfigPullRequestResponseDto(
      await this.queryBus.execute<
        ReadConfigPullRequestQuery,
        ConfigPullRequestDto
      >(new ReadConfigPullRequestQuery(teamId, pullRequestId, principal)),
    );
  }
}
