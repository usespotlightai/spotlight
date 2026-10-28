import { Get, HttpStatus, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import {
  ApiProblemResponse,
  ConventionalApiController,
} from '@platform/http/resources/conventional-api';
import type { StationImprovementDto } from '@replays/application/dto/station-improvements.dto';
import { ReadStationImprovementQuery } from '@replays/application/queries/read-station-improvement.query';
import { StationImprovementResponseDto } from '@replays/presentation/http/dto/station-improvements.response.dto';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

@ConventionalApiController('teams/:teamId', 'replays')
@ApiParam({ name: 'teamId', type: String })
@ApiProblemResponse(
  HttpStatus.NOT_FOUND,
  'No such team or station for this caller',
)
export class StationImprovementsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('lines/:lineId/stations/:stationId/improvement')
  @ApiOperation({
    operationId: 'readStationImprovement',
    summary:
      'What Spotlight does now to improve the station, from its search schedule, its active search, its config pull requests and its replay set',
  })
  @ApiParam({ name: 'lineId', type: String })
  @ApiParam({ name: 'stationId', type: String })
  @ApiOkResponse({ type: StationImprovementResponseDto })
  async read(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Param('stationId') stationId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<StationImprovementResponseDto> {
    return new StationImprovementResponseDto(
      await this.queryBus.execute<
        ReadStationImprovementQuery,
        StationImprovementDto
      >(new ReadStationImprovementQuery(teamId, lineId, stationId, principal)),
    );
  }
}
