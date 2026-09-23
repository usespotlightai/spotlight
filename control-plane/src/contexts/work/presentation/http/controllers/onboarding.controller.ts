import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import { ProposedResponseDto } from '@platform/http/dto/proposed.response.dto';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';
import { SetUpLinesCommand } from '@work/application/commands/set-up-lines.command';
import type { OnboardingDto } from '@work/application/dto/onboarding.dto';
import type { ProposedChangeDto } from '@work/application/dto/proposed-change.dto';
import { OnboardingQuery } from '@work/application/queries/onboarding.query';
import {
  KnownIntegrationResponseDto,
  OnboardingLineResponseDto,
  OnboardingResponseDto,
  SetUpLinesRequestDto,
  SetupStepResponseDto,
} from '@work/presentation/http/dto/onboarding.response.dto';

@ApiTags('onboarding')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId/configuration')
export class OnboardingController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('onboarding')
  @ApiOperation({
    operationId: 'readOnboarding',
    summary: 'What this team still needs, and the integrations it may choose',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiOkResponse({ type: OnboardingResponseDto })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async onboarding(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OnboardingResponseDto> {
    const read = await this.queryBus.execute<
      OnboardingQuery,
      OnboardingDto | null
    >(new OnboardingQuery(teamId, user.id));

    if (!read) {
      throw new NotFoundException();
    }

    return new OnboardingResponseDto(
      read.steps.map(
        (each) =>
          new SetupStepResponseDto(
            each.key,
            each.title,
            each.description,
            each.where,
            each.done,
          ),
      ),
      read.installUrl,
      read.connectedToGitHub,
      read.configRepository,
      read.repositoryOwner,
      read.lines.map(
        (each) =>
          new OnboardingLineResponseDto(
            each.key,
            each.name,
            each.harness,
            each.model,
            each.effort,
            each.repositories,
          ),
      ),
      read.integrations.map(
        (each) =>
          new KnownIntegrationResponseDto(
            each.source,
            each.name,
            each.summary,
            each.deliverTo,
          ),
      ),
    );
  }

  @Post('setup')
  @ApiOperation({
    operationId: 'setUpLines',
    summary: 'Assign each line a harness and repositories, and open the setup',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiOkResponse({ type: ProposedResponseDto })
  @ApiNotFoundResponse({
    description: 'No such team, or nowhere to write it yet',
  })
  async setUp(
    @Param('teamId') teamId: string,
    @Body() body: SetUpLinesRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProposedResponseDto> {
    const opened = await this.commandBus.execute<
      SetUpLinesCommand,
      ProposedChangeDto | null
    >(
      new SetUpLinesCommand(
        teamId,
        user.id,
        body.lines.map((line) => ({
          key: line.key,
          harness: line.harness ?? null,
          model: line.model ?? null,
          effort: line.effort ?? null,
          repositories: line.repositories,
        })),
      ),
    );

    if (!opened) {
      throw new NotFoundException();
    }

    return new ProposedResponseDto(opened.url);
  }
}
