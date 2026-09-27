import { EditMemoryCommand } from '@memory/application/commands/edit-memory.command';
import { RetireMemoryCommand } from '@memory/application/commands/retire-memory.command';
import {
  type MemoryWriting,
  WriteMemoryCommand,
} from '@memory/application/commands/write-memory.command';
import type {
  TeamMemoryDetailDto,
  TeamMemoryDto,
} from '@memory/application/dto/team-memory.dto';
import { ListTeamMemoriesQuery } from '@memory/application/queries/list-team-memories.query';
import { ReadTeamMemoryQuery } from '@memory/application/queries/read-team-memory.query';
import {
  RetireMemoryRequestDto,
  TeamMemoryDetailResponseDto,
  TeamMemoryResponseDto,
  WriteMemoryRequestDto,
} from '@memory/presentation/http/dto/team-memory.response.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const optional = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

const writingOf = (body: WriteMemoryRequestDto | undefined): MemoryWriting => ({
  kind: text(body?.kind),
  body: text(body?.body),
  lineId: optional(body?.lineId),
  stationId: optional(body?.stationId),
  repository: optional(body?.repository),
  paths: Array.isArray(body?.paths)
    ? body.paths.filter((each): each is string => typeof each === 'string')
    : [],
});

@ApiTags('memories')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'teamId', type: String })
@Controller('teams/:teamId/memories')
export class TeamMemoryController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listTeamMemories',
    summary:
      'What the team remembers, narrowed by where it applies and its kind',
  })
  @ApiQuery({ name: 'standing', required: false, enum: ['stands', 'retired'] })
  @ApiQuery({ name: 'kind', required: false, type: String })
  @ApiQuery({ name: 'lineId', required: false, type: String })
  @ApiQuery({ name: 'stationId', required: false, type: String })
  @ApiQuery({ name: 'repository', required: false, type: String })
  @ApiQuery({
    name: 'path',
    required: false,
    type: String,
    description: 'Memories about paths beginning with this one',
  })
  @ApiOkResponse({ type: TeamMemoryResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  @ApiUnprocessableEntityResponse({
    description: 'A standing or kind no memory has',
  })
  async list(
    @Param('teamId') teamId: string,
    @Query() query: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamMemoryResponseDto[]> {
    const listed = await this.queryBus.execute<
      ListTeamMemoriesQuery,
      TeamMemoryDto[]
    >(
      new ListTeamMemoriesQuery(teamId, user.id, {
        standing: optional(query.standing),
        kind: optional(query.kind),
        lineId: optional(query.lineId),
        stationId: optional(query.stationId),
        repository: optional(query.repository),
        path: optional(query.path),
      }),
    );

    return listed.map((each) => new TeamMemoryResponseDto(each));
  }

  @Post()
  @ApiOperation({
    operationId: 'writeMemory',
    summary: 'Tell the team something to remember; it stands at once',
  })
  @ApiBody({ type: WriteMemoryRequestDto })
  @ApiCreatedResponse({ type: TeamMemoryDetailResponseDto })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  @ApiUnprocessableEntityResponse({
    description:
      'An unknown kind, a body too long, or a line, station or repository the team does not have',
  })
  async write(
    @Param('teamId') teamId: string,
    @Body() body: WriteMemoryRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamMemoryDetailResponseDto> {
    return new TeamMemoryDetailResponseDto(
      await this.commandBus.execute<WriteMemoryCommand, TeamMemoryDetailDto>(
        new WriteMemoryCommand(teamId, user.id, writingOf(body)),
      ),
    );
  }

  @Get(':memoryId')
  @ApiOperation({
    operationId: 'readTeamMemory',
    summary:
      'One memory with what it rests on, and what it replaced or was replaced by',
  })
  @ApiParam({ name: 'memoryId', type: String })
  @ApiOkResponse({ type: TeamMemoryDetailResponseDto })
  @ApiNotFoundResponse({ description: 'No such memory for this caller' })
  async read(
    @Param('teamId') teamId: string,
    @Param('memoryId') memoryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamMemoryDetailResponseDto> {
    return new TeamMemoryDetailResponseDto(
      await this.queryBus.execute<ReadTeamMemoryQuery, TeamMemoryDetailDto>(
        new ReadTeamMemoryQuery(teamId, memoryId, user.id),
      ),
    );
  }

  @Post(':memoryId/edit')
  @ApiOperation({
    operationId: 'editMemory',
    summary:
      'Correct a memory: a new one replaces it, keeping what it rests on, and it is retired',
  })
  @ApiParam({ name: 'memoryId', type: String })
  @ApiBody({ type: WriteMemoryRequestDto })
  @ApiCreatedResponse({ type: TeamMemoryDetailResponseDto })
  @ApiNotFoundResponse({ description: 'No such memory for this caller' })
  @ApiConflictResponse({ description: 'It was already retired' })
  @ApiUnprocessableEntityResponse({
    description:
      'An unknown kind, a body too long, or a line, station or repository the team does not have',
  })
  async edit(
    @Param('teamId') teamId: string,
    @Param('memoryId') memoryId: string,
    @Body() body: WriteMemoryRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamMemoryDetailResponseDto> {
    return new TeamMemoryDetailResponseDto(
      await this.commandBus.execute<EditMemoryCommand, TeamMemoryDetailDto>(
        new EditMemoryCommand(teamId, memoryId, user.id, writingOf(body)),
      ),
    );
  }

  @Post(':memoryId/retire')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'retireMemory',
    summary: 'Stop a memory being given to runs, saying why',
  })
  @ApiParam({ name: 'memoryId', type: String })
  @ApiBody({ type: RetireMemoryRequestDto })
  @ApiOkResponse({ type: TeamMemoryDetailResponseDto })
  @ApiNotFoundResponse({ description: 'No such memory for this caller' })
  @ApiConflictResponse({ description: 'It was already retired' })
  @ApiUnprocessableEntityResponse({
    description: 'No reason given, or one too long',
  })
  async retire(
    @Param('teamId') teamId: string,
    @Param('memoryId') memoryId: string,
    @Body() body: RetireMemoryRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamMemoryDetailResponseDto> {
    return new TeamMemoryDetailResponseDto(
      await this.commandBus.execute<RetireMemoryCommand, TeamMemoryDetailDto>(
        new RetireMemoryCommand(teamId, memoryId, user.id, text(body?.reason)),
      ),
    );
  }
}
