import { ForgetCommand } from '@memory/application/commands/forget.command';
import { RecordDeliveryCommand } from '@memory/application/commands/record-delivery.command';
import { RecordRecallCommand } from '@memory/application/commands/record-recall.command';
import { RememberCommand } from '@memory/application/commands/remember.command';
import type { ProposedMemoryDto } from '@memory/application/dto/memory-review.dto';
import type { RecalledMemoryDto } from '@memory/application/dto/recalled-memory.dto';
import type { TeamMemoryDto } from '@memory/application/dto/team-memory.dto';
import { ReadProposedMemoryQuery } from '@memory/application/queries/read-proposed-memory.query';
import { RecallMemoriesQuery } from '@memory/application/queries/recall-memories.query';
import { RecallMemoryQuery } from '@memory/application/queries/recall-memory.query';
import { ProposedMemoryResponseDto } from '@memory/presentation/http/dto/memory-review.response.dto';
import {
  DeliveredMemoriesRequestDto,
  ForgetRequestDto,
  RecallMemoriesRequestDto,
  RememberRequestDto,
} from '@memory/presentation/http/dto/runner-memory.request.dto';
import { RecalledMemoryResponseDto } from '@memory/presentation/http/dto/runner-memory.response.dto';
import { TeamMemoryResponseDto } from '@memory/presentation/http/dto/team-memory.response.dto';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentMachine } from '@platform/http/decorators/current-machine.decorator';
import { MachineOnly } from '@platform/http/decorators/machine-only.decorator';

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const optional = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

@ApiTags('runners')
@ApiUnauthorizedResponse({
  description: 'Missing, no longer valid or wrong runner token',
})
@ApiParam({ name: 'runId', type: String })
@ApiNotFoundResponse({ description: 'No such run leased by this runner' })
@MachineOnly()
@Controller('runs/:runId/memories')
export class RunnerMemoryController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('recall')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'recallMemories',
    summary:
      'Search what the run’s team remembers, for an agent that needs more than its briefing. It records what the run recalled',
  })
  @ApiBody({ type: RecallMemoriesRequestDto })
  @ApiOkResponse({ type: TeamMemoryResponseDto, isArray: true })
  @ApiUnprocessableEntityResponse({ description: 'Nothing to look for' })
  @ApiConflictResponse({
    description:
      'The run is a search, which recalls nothing the team remembers',
  })
  @ApiBody({ type: RecallMemoriesRequestDto })
  async recall(
    @Param('runId') runId: string,
    @Body() body: RecallMemoriesRequestDto | undefined,
    @CurrentMachine() runnerId: string,
  ): Promise<TeamMemoryResponseDto[]> {
    const recalled = await this.queryBus.execute<
      RecallMemoriesQuery,
      TeamMemoryDto[]
    >(new RecallMemoriesQuery(runId, runnerId, text(body?.words)));
    await this.commandBus.execute<RecordRecallCommand, void>(
      new RecordRecallCommand(
        runId,
        runnerId,
        recalled.map((each) => each.id),
      ),
    );

    return recalled.map((each) => new TeamMemoryResponseDto(each));
  }

  @Post('delivered')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'recordDeliveredMemories',
    summary:
      'Record the memories the run showed its agent because the agent used a path they are about',
  })
  @ApiBody({ type: DeliveredMemoriesRequestDto })
  @ApiNoContentResponse({ description: 'Recorded' })
  @ApiUnprocessableEntityResponse({ description: 'Not a handle like M-12' })
  @ApiConflictResponse({
    description:
      'The run is a search, which is shown nothing the team remembers',
  })
  @ApiBody({ type: DeliveredMemoriesRequestDto })
  async delivered(
    @Param('runId') runId: string,
    @Body() body: DeliveredMemoriesRequestDto | undefined,
    @CurrentMachine() runnerId: string,
  ): Promise<void> {
    await this.commandBus.execute<RecordDeliveryCommand, void>(
      new RecordDeliveryCommand(
        runId,
        runnerId,
        Array.isArray(body?.handles)
          ? body.handles.filter(
              (each): each is string => typeof each === 'string',
            )
          : [],
      ),
    );
  }

  @Post(':handle/recall')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'recallMemory',
    summary:
      'Read one of the team’s memories in full, by its handle. It records that the run recalled it',
  })
  @ApiParam({ name: 'handle', type: String, example: 'M-12' })
  @ApiOkResponse({ type: RecalledMemoryResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'Not a handle like M-12' })
  @ApiConflictResponse({
    description:
      'The run is a search, which recalls nothing the team remembers',
  })
  async recallOne(
    @Param('runId') runId: string,
    @Param('handle') handle: string,
    @CurrentMachine() runnerId: string,
  ): Promise<RecalledMemoryResponseDto> {
    const recalled = await this.queryBus.execute<
      RecallMemoryQuery,
      RecalledMemoryDto
    >(new RecallMemoryQuery(runId, runnerId, handle));
    await this.commandBus.execute<RecordRecallCommand, void>(
      new RecordRecallCommand(runId, runnerId, [recalled.id]),
    );

    return new RecalledMemoryResponseDto(recalled);
  }

  @Post()
  @ApiOperation({
    operationId: 'remember',
    summary:
      'Propose a memory from inside the run that cites the step that proposed it',
    description:
      'It waits in the inbox beside the task for a person to approve.',
  })
  @ApiBody({ type: RememberRequestDto })
  @ApiCreatedResponse({ type: ProposedMemoryResponseDto })
  @ApiConflictResponse({
    description:
      'The run is isolated from the team or set at a past time, and remembers nothing for the team',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'An unknown kind or scope, a path outside the run’s repositories, or a chat run',
  })
  @ApiBody({ type: RememberRequestDto })
  async remember(
    @Param('runId') runId: string,
    @Body() body: RememberRequestDto | undefined,
    @CurrentMachine() runnerId: string,
  ): Promise<ProposedMemoryResponseDto> {
    const memoryId = await this.commandBus.execute<RememberCommand, string>(
      new RememberCommand(runId, runnerId, {
        kind: text(body?.kind),
        body: text(body?.body),
        scope: optional(body?.scope),
        paths: Array.isArray(body?.paths)
          ? body.paths.filter(
              (each): each is string => typeof each === 'string',
            )
          : [],
        supersedes: optional(body?.supersedes),
      }),
    );

    return this.proposed(runId, runnerId, memoryId);
  }

  @Post(':handle/forget')
  @ApiOperation({
    operationId: 'forget',
    summary:
      'Propose from inside the run that a memory is wrong and should be retired, citing the step that proposed it',
    description:
      'It waits in the inbox beside the task for a person to approve. On approval the memory is retired with the reason given.',
  })
  @ApiParam({ name: 'handle', type: String, example: 'M-12' })
  @ApiBody({ type: ForgetRequestDto })
  @ApiCreatedResponse({ type: ProposedMemoryResponseDto })
  @ApiConflictResponse({
    description:
      'The run is isolated from the team or set at a past time, and changes nothing the team remembers',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Not a handle like M-12, a memory that is not active in the run’s team, no reason, or a chat run',
  })
  @ApiBody({ type: ForgetRequestDto })
  async forget(
    @Param('runId') runId: string,
    @Param('handle') handle: string,
    @Body() body: ForgetRequestDto | undefined,
    @CurrentMachine() runnerId: string,
  ): Promise<ProposedMemoryResponseDto> {
    const memoryId = await this.commandBus.execute<ForgetCommand, string>(
      new ForgetCommand(runId, runnerId, handle, text(body?.because)),
    );

    return this.proposed(runId, runnerId, memoryId);
  }

  private async proposed(
    runId: string,
    runnerId: string,
    memoryId: string,
  ): Promise<ProposedMemoryResponseDto> {
    return new ProposedMemoryResponseDto(
      await this.queryBus.execute<ReadProposedMemoryQuery, ProposedMemoryDto>(
        new ReadProposedMemoryQuery(runId, runnerId, memoryId),
      ),
    );
  }
}
