import { CustomiseStationCommand } from '@application/commands/customise-station.command';
import { ReorderStationsCommand } from '@application/commands/reorder-stations.command';
import { SetLineReactionsCommand } from '@application/commands/set-line-reactions.command';
import type {
  AssemblyLineDto,
  StationDto,
} from '@application/dto/assembly-line.dto';
import type { AuthenticatedUser } from '@application/ports/session.port';
import { FindStationQuery } from '@application/queries/find-station.query';
import { ListAssemblyLinesQuery } from '@application/queries/list-assembly-lines.query';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
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
import {
  AssemblyLineResponseDto,
  StationResponseDto,
} from '@presentation/http/dto/assembly-line.response.dto';
import { CustomiseStationRequestDto } from '@presentation/http/dto/customise-station.request.dto';
import { ReorderStationsRequestDto } from '@presentation/http/dto/reorder-stations.request.dto';
import { SetLineReactionsRequestDto } from '@presentation/http/dto/set-line-reactions.request.dto';
import { AssemblyLineHttpMapper } from '@presentation/http/mappers/assembly-line.http.mapper';

@ApiTags('assembly-lines')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId/assembly-lines')
export class AssemblyLineController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listAssemblyLines',
    summary: 'List a team’s assembly lines, each with its stations in order',
  })
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @ApiOkResponse({ type: AssemblyLineResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async list(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AssemblyLineResponseDto[]> {
    const lines = await this.queryBus.execute<
      ListAssemblyLinesQuery,
      AssemblyLineDto[] | null
    >(new ListAssemblyLinesQuery(teamId, user.id));

    if (!lines) {
      throw new NotFoundException();
    }

    return lines.map(AssemblyLineHttpMapper.toResponse);
  }

  @Post(':lineId/stations/order')
  @ApiOperation({
    operationId: 'reorderStations',
    summary: 'Set the left to right order of a line’s stations',
  })
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @ApiParam({ name: 'lineId', example: '7b2c9e14-3a5d-4c8f-b6e1-9d0a2f7c5b43' })
  @ApiOkResponse({ type: AssemblyLineResponseDto })
  @ApiNotFoundResponse({ description: 'No such line for this caller' })
  @ApiUnprocessableEntityResponse({ description: 'Not every station named' })
  @HttpCode(HttpStatus.OK)
  async reorder(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Body() body: ReorderStationsRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AssemblyLineResponseDto> {
    const lines = await this.queryBus.execute<
      ListAssemblyLinesQuery,
      AssemblyLineDto[] | null
    >(new ListAssemblyLinesQuery(teamId, user.id));

    if (!lines?.some((line) => line.id === lineId)) {
      throw new NotFoundException();
    }

    const reordered = await this.commandBus.execute<
      ReorderStationsCommand,
      AssemblyLineDto
    >(new ReorderStationsCommand(lineId, body.stationIds));

    return AssemblyLineHttpMapper.toResponse(reordered);
  }

  @Put(':lineId/reactions')
  @ApiOperation({
    operationId: 'setLineReactions',
    summary: 'Set what this line does when a word comes in from outside',
  })
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @ApiParam({ name: 'lineId', example: '7b2c9e14-3a5d-4c8f-b6e1-9d0a2f7c5b43' })
  @ApiOkResponse({ type: AssemblyLineResponseDto })
  @ApiNotFoundResponse({ description: 'No such line for this caller' })
  @ApiUnprocessableEntityResponse({
    description: 'A word nobody raises, or two rules that collide',
  })
  @HttpCode(HttpStatus.OK)
  async react(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Body() body: SetLineReactionsRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AssemblyLineResponseDto> {
    const lines = await this.queryBus.execute<
      ListAssemblyLinesQuery,
      AssemblyLineDto[] | null
    >(new ListAssemblyLinesQuery(teamId, user.id));

    if (!lines?.some((line) => line.id === lineId)) {
      throw new NotFoundException();
    }

    const changed = await this.commandBus.execute<
      SetLineReactionsCommand,
      AssemblyLineDto
    >(
      new SetLineReactionsCommand(
        lineId,
        (body.reactions ?? []).map((each) => ({
          happening: each.happening,
          from: each.from ?? null,
          to: each.to,
        })),
      ),
    );

    return AssemblyLineHttpMapper.toResponse(changed);
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
  @ApiOkResponse({ type: StationResponseDto })
  @ApiNotFoundResponse({ description: 'No such station for this caller' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid field' })
  async customise(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Param('stationId') stationId: string,
    @Body() body: CustomiseStationRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationResponseDto> {
    const visible = await this.queryBus.execute<
      FindStationQuery,
      StationDto | null
    >(new FindStationQuery(teamId, lineId, stationId, user.id));

    if (!visible) {
      throw new NotFoundException();
    }

    const station = await this.commandBus.execute<
      CustomiseStationCommand,
      StationDto
    >(
      new CustomiseStationCommand(
        lineId,
        stationId,
        AssemblyLineHttpMapper.toStationChanges(body),
      ),
    );

    return AssemblyLineHttpMapper.stationToResponse(station);
  }
}
