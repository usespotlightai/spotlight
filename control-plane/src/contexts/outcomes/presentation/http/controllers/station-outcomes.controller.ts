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
import type { StationOutcomesDto } from '@outcomes/application/dto/station-outcomes.dto';
import { ListStationOutcomesQuery } from '@outcomes/application/queries/list-station-outcomes.query';
import { StationOutcomesResponseDto } from '@outcomes/presentation/http/dto/station-outcomes.response.dto';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

const lastOf = (raw: unknown): number | null => {
  const asked = typeof raw === 'string' ? Number(raw) : Number.NaN;
  return Number.isInteger(asked) ? asked : null;
};

@ApiTags('outcomes')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId/lines/:lineId/stations/:stationId/outcomes')
export class StationOutcomesController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'listStationOutcomes',
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
      'How many of the latest runs to look at: 50 unless asked, 200 at most',
  })
  @ApiOkResponse({ type: StationOutcomesResponseDto })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async list(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Param('stationId') stationId: string,
    @Query('last') last: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationOutcomesResponseDto> {
    return new StationOutcomesResponseDto(
      await this.queryBus.execute<ListStationOutcomesQuery, StationOutcomesDto>(
        new ListStationOutcomesQuery(
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
