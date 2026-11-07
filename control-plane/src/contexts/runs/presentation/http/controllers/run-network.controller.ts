import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { RunNetworkDto } from '@runs/application/dto/run-network.dto';
import { ReadRunNetworkQuery } from '@runs/application/queries/read-run-network.query';
import { RunNetworkResponseDto } from '@runs/presentation/http/dto/run-network.response.dto';

@ApiTags('tasks')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({
  name: 'teamId',
  type: String,
  example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84',
})
@Controller('teams/:teamId')
export class RunNetworkController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('runs/:runId/network')
  @ApiOperation({
    operationId: 'readRunNetwork',
    summary:
      'The connections a run made through a shared egress, and if egress was enforced',
  })
  @ApiParam({ name: 'runId', type: String })
  @ApiOkResponse({ type: RunNetworkResponseDto })
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  async network(
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunNetworkResponseDto> {
    const found = await this.queryBus.execute<
      ReadRunNetworkQuery,
      RunNetworkDto | null
    >(new ReadRunNetworkQuery(runId, user.id));

    if (!found) {
      throw new NotFoundException();
    }

    return new RunNetworkResponseDto(found);
  }
}
