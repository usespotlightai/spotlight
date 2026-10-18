import type { StationJudgeDto } from '@insights/application/dto/station-judge.dto';
import { ReadStationJudgeQuery } from '@insights/application/queries/read-station-judge.query';
import { StationJudgeAgreementResponseDto } from '@insights/presentation/http/dto/station-judge.response.dto';
import { Controller, Get, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

@ApiTags('insights')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId/lines/:lineId/stations/:stationId/judge')
export class StationJudgeController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'readStationJudge',
    summary:
      'How often the station’s judge agrees with people, under each of its rubrics',
  })
  @ApiParam({ name: 'teamId', type: String })
  @ApiParam({ name: 'lineId', type: String })
  @ApiParam({ name: 'stationId', type: String })
  @ApiOkResponse({ type: StationJudgeAgreementResponseDto })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async read(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Param('stationId') stationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationJudgeAgreementResponseDto> {
    return new StationJudgeAgreementResponseDto(
      await this.queryBus.execute<ReadStationJudgeQuery, StationJudgeDto>(
        new ReadStationJudgeQuery(teamId, lineId, stationId, user.id),
      ),
    );
  }
}
