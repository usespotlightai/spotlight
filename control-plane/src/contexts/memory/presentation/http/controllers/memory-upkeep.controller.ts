import {
  DecideUpkeepProposalCommand,
  type UpkeepDecision,
} from '@memory/application/commands/decide-upkeep-proposal.command';
import type { MemoryUpkeepDto } from '@memory/application/dto/memory-upkeep.dto';
import { ReadMemoryUpkeepQuery } from '@memory/application/queries/read-memory-upkeep.query';
import { MemoryUpkeepResponseDto } from '@memory/presentation/http/dto/memory-upkeep.response.dto';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';

@ApiTags('memories')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'teamId', type: String })
@ApiParam({ name: 'upkeepId', type: String })
@ApiNotFoundResponse({ description: 'No such upkeep for this caller' })
@Controller('teams/:teamId/memory-upkeep/:upkeepId')
export class MemoryUpkeepController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'readMemoryUpkeep',
    summary:
      'What a sweep of the team’s memory proposes to retire or merge, each with why',
  })
  @ApiOkResponse({ type: MemoryUpkeepResponseDto })
  async upkeep(
    @Param('teamId') teamId: string,
    @Param('upkeepId') upkeepId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MemoryUpkeepResponseDto> {
    return this.upkeepOf(teamId, upkeepId, user.id);
  }

  @Post('proposals/:proposalId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'approveUpkeepProposal',
    summary:
      'Make a proposed change to the team’s memory: retire or merge the memories it names',
  })
  @ApiParam({ name: 'proposalId', type: String })
  @ApiOkResponse({ type: MemoryUpkeepResponseDto })
  @ApiConflictResponse({
    description: 'It was decided meanwhile',
  })
  approve(
    @Param('teamId') teamId: string,
    @Param('upkeepId') upkeepId: string,
    @Param('proposalId') proposalId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MemoryUpkeepResponseDto> {
    return this.decided(teamId, upkeepId, proposalId, 'approve', user.id);
  }

  @Post('proposals/:proposalId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'rejectUpkeepProposal',
    summary:
      'Keep the memories a proposed change names as they are; later sweeps leave them be for 90 days',
  })
  @ApiParam({ name: 'proposalId', type: String })
  @ApiOkResponse({ type: MemoryUpkeepResponseDto })
  @ApiConflictResponse({
    description: 'It was decided meanwhile',
  })
  reject(
    @Param('teamId') teamId: string,
    @Param('upkeepId') upkeepId: string,
    @Param('proposalId') proposalId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MemoryUpkeepResponseDto> {
    return this.decided(teamId, upkeepId, proposalId, 'reject', user.id);
  }

  private async decided(
    teamId: string,
    upkeepId: string,
    proposalId: string,
    decision: UpkeepDecision,
    viewerId: string,
  ): Promise<MemoryUpkeepResponseDto> {
    await this.commandBus.execute<DecideUpkeepProposalCommand, void>(
      new DecideUpkeepProposalCommand(
        teamId,
        upkeepId,
        proposalId,
        decision,
        viewerId,
      ),
    );

    return this.upkeepOf(teamId, upkeepId, viewerId);
  }

  private async upkeepOf(
    teamId: string,
    upkeepId: string,
    viewerId: string,
  ): Promise<MemoryUpkeepResponseDto> {
    const found = await this.queryBus.execute<
      ReadMemoryUpkeepQuery,
      MemoryUpkeepDto | null
    >(new ReadMemoryUpkeepQuery(teamId, upkeepId, viewerId));

    if (!found) {
      throw new NotFoundException(`No memory upkeep ${upkeepId} in this team.`);
    }

    return new MemoryUpkeepResponseDto(found);
  }
}
