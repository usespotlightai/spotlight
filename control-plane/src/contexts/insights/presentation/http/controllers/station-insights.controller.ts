import type { StationInsightsDto } from '@insights/application/dto/station-insights.dto';
import { ReadStationInsightsQuery } from '@insights/application/queries/read-station-insights.query';
import { StationInsightsResponseDto } from '@insights/presentation/http/dto/station-insights.response.dto';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

const lastOf = (raw: unknown): number | null => {
  const value = typeof raw === 'string' ? Number(raw) : Number.NaN;
  return Number.isInteger(value) ? value : null;
};

@ApiTags('insights')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId/lines/:lineId/stations/:stationId/insights')
export class StationInsightsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'readStationInsights',
    summary:
      'How the station’s latest runs turned out, in runs of the same config',
  })
  @ApiParam({ name: 'teamId', type: String })
  @ApiParam({ name: 'lineId', type: String })
  @ApiParam({ name: 'stationId', type: String })
  @ApiQuery({
    name: 'last',
    required: false,
    type: Number,
    description:
      'How many of the latest-started runs to look at: 50 by default, 200 at most',
  })
  @ApiOkResponse({ type: StationInsightsResponseDto })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async read(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Param('stationId') stationId: string,
    @Query('last') last: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationInsightsResponseDto> {
    return new StationInsightsResponseDto(
      await this.queryBus.execute<ReadStationInsightsQuery, StationInsightsDto>(
        new ReadStationInsightsQuery(
          teamId,
          lineId,
          stationId,
          user.id,
          lastOf(last),
        ),
      ),
    );
  }
}
