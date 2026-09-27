import { RememberCommand } from '@memory/application/commands/remember.command';
import type { ProposedMemoryDto } from '@memory/application/dto/memory-review.dto';
import type {
  TeamMemoryDetailDto,
  TeamMemoryDto,
} from '@memory/application/dto/team-memory.dto';
import { RecallMemoriesQuery } from '@memory/application/queries/recall-memories.query';
import { RecallMemoryQuery } from '@memory/application/queries/recall-memory.query';
import { ProposedMemoryResponseDto } from '@memory/presentation/http/dto/memory-review.response.dto';
import { RememberRequestDto } from '@memory/presentation/http/dto/runner-memory.request.dto';
import {
  TeamMemoryDetailResponseDto,
  TeamMemoryResponseDto,
} from '@memory/presentation/http/dto/team-memory.response.dto';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBody,
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
import { CurrentRunner } from '@platform/http/decorators/current-runner.decorator';
import { RunnerOnly } from '@platform/http/decorators/runner-only.decorator';

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const optional = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

@ApiTags('runners')
@ApiUnauthorizedResponse({
  description: 'Missing, spent or wrong runner token',
})
@ApiParam({ name: 'runId', type: String })
@ApiNotFoundResponse({ description: 'No such run held by this runner' })
@RunnerOnly()
@Controller('runs/:runId/memories')
export class RunnerMemoryController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'recallMemories',
    summary:
      'Search what the run’s team remembers, for an agent reaching past its briefing',
  })
  @ApiQuery({ name: 'q', type: String, description: 'Words to look for' })
  @ApiOkResponse({ type: TeamMemoryResponseDto, isArray: true })
  @ApiUnprocessableEntityResponse({ description: 'Nothing to look for' })
  async recall(
    @Param('runId') runId: string,
    @Query('q') words: unknown,
    @CurrentRunner() runnerId: string,
  ): Promise<TeamMemoryResponseDto[]> {
    const recalled = await this.queryBus.execute<
      RecallMemoriesQuery,
      TeamMemoryDto[]
    >(new RecallMemoriesQuery(runId, runnerId, text(words)));

    return recalled.map((each) => new TeamMemoryResponseDto(each));
  }

  @Get(':handle')
  @ApiOperation({
    operationId: 'recallMemory',
    summary: 'Read one of the team’s memories in full, by its handle',
  })
  @ApiParam({ name: 'handle', type: String, example: 'M-12' })
  @ApiOkResponse({ type: TeamMemoryDetailResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'Not a handle like M-12' })
  async recallOne(
    @Param('runId') runId: string,
    @Param('handle') handle: string,
    @CurrentRunner() runnerId: string,
  ): Promise<TeamMemoryDetailResponseDto> {
    return new TeamMemoryDetailResponseDto(
      await this.queryBus.execute<RecallMemoryQuery, TeamMemoryDetailDto>(
        new RecallMemoryQuery(runId, runnerId, handle),
      ),
    );
  }

  @Post()
  @ApiOperation({
    operationId: 'remember',
    summary:
      'Propose a memory from inside the run, grounded in the step it was asked from',
    description:
      'It waits in the inbox beside the task for a person to approve, like a drafted memory.',
  })
  @ApiBody({ type: RememberRequestDto })
  @ApiCreatedResponse({ type: ProposedMemoryResponseDto })
  @ApiUnprocessableEntityResponse({
    description:
      'An unknown kind or reach, a path outside the run’s repositories, or a chat run',
  })
  async remember(
    @Param('runId') runId: string,
    @Body() body: RememberRequestDto | undefined,
    @CurrentRunner() runnerId: string,
  ): Promise<ProposedMemoryResponseDto> {
    return new ProposedMemoryResponseDto(
      await this.commandBus.execute<RememberCommand, ProposedMemoryDto>(
        new RememberCommand(runId, runnerId, {
          kind: text(body?.kind),
          body: text(body?.body),
          reach: optional(body?.reach),
          paths: Array.isArray(body?.paths)
            ? body.paths.filter(
                (each): each is string => typeof each === 'string',
              )
            : [],
          supersedes: optional(body?.supersedes),
        }),
      ),
    );
  }
}
