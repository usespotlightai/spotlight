import { CustomiseStationCommand } from '@application/commands/customise-station.command';
import { SetLineRepositoriesCommand } from '@application/commands/set-line-repositories.command';
import type { LineDto, StationDto } from '@application/dto/line.dto';
import type { OpenedPullRequestDto } from '@application/ports/pull-request.port';
import type { AuthenticatedUser } from '@application/ports/session.port';
import { FindStationQuery } from '@application/queries/find-station.query';
import { ListLinesQuery } from '@application/queries/list-lines.query';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@presentation/http/decorators/current-user.decorator';
import { ProposedResponseDto } from '@presentation/http/dto/configuration.response.dto';
import { CustomiseStationRequestDto } from '@presentation/http/dto/customise-station.request.dto';
import { LineResponseDto } from '@presentation/http/dto/line.response.dto';
import { SetLineRepositoriesRequestDto } from '@presentation/http/dto/set-line-repositories.request.dto';
import { LineHttpMapper } from '@presentation/http/mappers/line.http.mapper';

@ApiTags('lines')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId/lines')
export class LineController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listLines',
    summary: 'List a team’s lines, each with its stations in order',
  })
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @ApiOkResponse({ type: LineResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async list(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LineResponseDto[]> {
    const lines = await this.queryBus.execute<ListLinesQuery, LineDto[] | null>(
      new ListLinesQuery(teamId, user.id),
    );

    if (!lines) {
      throw new NotFoundException();
    }

    return lines.map(LineHttpMapper.toResponse);
  }

  @Patch(':lineId/stations/:stationId')
  @ApiOperation({
    operationId: 'customiseStation',
    summary:
      'Change what a station is called, says, runs on and tells its agent',
  })
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @ApiParam({ name: 'lineId', example: '7b2c9e14-3a5d-4c8f-b6e1-9d0a2f7c5b43' })
  @ApiParam({
    name: 'stationId',
    example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80',
  })
  @ApiOkResponse({ type: ProposedResponseDto })
  @ApiNotFoundResponse({
    description: 'No such station, or nowhere to write it',
  })
  @ApiUnprocessableEntityResponse({ description: 'Invalid field' })
  async customise(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Param('stationId') stationId: string,
    @Body() body: CustomiseStationRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProposedResponseDto> {
    const visible = await this.queryBus.execute<
      FindStationQuery,
      StationDto | null
    >(new FindStationQuery(teamId, lineId, stationId, user.id));

    if (!visible) {
      throw new NotFoundException();
    }

    const opened = await this.commandBus.execute<
      CustomiseStationCommand,
      OpenedPullRequestDto | null
    >(
      new CustomiseStationCommand(
        teamId,
        user.id,
        lineId,
        stationId,
        LineHttpMapper.toStationChanges(body),
      ),
    );

    if (!opened) {
      throw new NotFoundException();
    }

    return new ProposedResponseDto(opened.url);
  }

  @Patch(':lineId/repositories')
  @ApiOperation({
    operationId: 'setLineRepositories',
    summary: 'Set the repositories a line, and so its every station, works in',
  })
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @ApiParam({ name: 'lineId', example: '7b2c9e14-3a5d-4c8f-b6e1-9d0a2f7c5b43' })
  @ApiOkResponse({ type: ProposedResponseDto })
  @ApiNotFoundResponse({ description: 'No such line, or nowhere to write it' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid repository' })
  async setRepositories(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Body() body: SetLineRepositoriesRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProposedResponseDto> {
    const opened = await this.commandBus.execute<
      SetLineRepositoriesCommand,
      OpenedPullRequestDto | null
    >(
      new SetLineRepositoriesCommand(
        teamId,
        user.id,
        lineId,
        body.repositories,
      ),
    );

    if (!opened) {
      throw new NotFoundException();
    }

    return new ProposedResponseDto(opened.url);
  }
}
