import { RecallMemoriesCommand } from '@memory/application/commands/recall-memories.command';
import { RecallMemoryCommand } from '@memory/application/commands/recall-memory.command';
import { RememberCommand } from '@memory/application/commands/remember.command';
import type { ProposedMemoryDto } from '@memory/application/dto/memory-review.dto';
import type {
  TeamMemoryDetailDto,
  TeamMemoryDto,
} from '@memory/application/dto/team-memory.dto';
import { ProposedMemoryResponseDto } from '@memory/presentation/http/dto/memory-review.response.dto';
import {
  RecallMemoriesRequestDto,
  RememberRequestDto,
} from '@memory/presentation/http/dto/runner-memory.request.dto';
import {
  TeamMemoryDetailResponseDto,
  TeamMemoryResponseDto,
} from '@memory/presentation/http/dto/team-memory.response.dto';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
@ApiNotFoundResponse({ description: 'No such run leased by this runner' })
@RunnerOnly()
@Controller('runs/:runId/memories')
export class RunnerMemoryController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('recall')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'recallMemories',
    summary:
      'Search what the run’s team remembers, for an agent reaching past its briefing, noting what it recalled',
  })
  @ApiBody({ type: RecallMemoriesRequestDto })
  @ApiOkResponse({ type: TeamMemoryResponseDto, isArray: true })
  @ApiUnprocessableEntityResponse({ description: 'Nothing to look for' })
  @ApiConflictResponse({
    description:
      'The run is a search, which recalls nothing the team remembers',
  })
  async recall(
    @Param('runId') runId: string,
    @Body() body: RecallMemoriesRequestDto | undefined,
    @CurrentRunner() runnerId: string,
  ): Promise<TeamMemoryResponseDto[]> {
    const recalled = await this.commandBus.execute<
      RecallMemoriesCommand,
      TeamMemoryDto[]
    >(new RecallMemoriesCommand(runId, runnerId, text(body?.words)));

    return recalled.map((each) => new TeamMemoryResponseDto(each));
  }

  @Post(':handle/recall')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'recallMemory',
    summary:
      'Read one of the team’s memories in full, by its handle, noting the run recalled it',
  })
  @ApiParam({ name: 'handle', type: String, example: 'M-12' })
  @ApiOkResponse({ type: TeamMemoryDetailResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'Not a handle like M-12' })
  @ApiConflictResponse({
    description:
      'The run is a search, which recalls nothing the team remembers',
  })
  async recallOne(
    @Param('runId') runId: string,
    @Param('handle') handle: string,
    @CurrentRunner() runnerId: string,
  ): Promise<TeamMemoryDetailResponseDto> {
    return new TeamMemoryDetailResponseDto(
      await this.commandBus.execute<RecallMemoryCommand, TeamMemoryDetailDto>(
        new RecallMemoryCommand(runId, runnerId, handle),
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
  @ApiConflictResponse({
    description:
      'The run is a replay or a search, which remembers nothing for the team',
  })
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
