import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
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
import type { OnboardingDto } from '@work/application/dto/onboarding.dto';
import { OnboardingQuery } from '@work/application/queries/onboarding.query';
import {
  OnboardingResponseDto,
  SetupChatResponseDto,
  SetupConnectionResponseDto,
  SetupStepResponseDto,
} from '@work/presentation/http/dto/onboarding.response.dto';

@ApiTags('onboarding')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId/configuration')
export class OnboardingController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('onboarding')
  @ApiOperation({
    operationId: 'readOnboarding',
    summary: 'What this team still needs',
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
            each.done,
          ),
      ),
      read.setupChat
        ? new SetupChatResponseDto(
            read.setupChat.id,
            read.setupChat.pullRequest,
          )
        : null,
      read.connections.map((each) => new SetupConnectionResponseDto(each)),
    );
  }
}
