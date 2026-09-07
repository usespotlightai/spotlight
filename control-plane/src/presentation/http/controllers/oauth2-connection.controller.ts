import { BeginOAuth2ConnectionCommand } from '@application/commands/begin-oauth2-connection.command';
import { FinishOAuth2ConnectionCommand } from '@application/commands/finish-oauth2-connection.command';
import type { AuthenticatedUser } from '@application/ports/session.port';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiExcludeEndpoint,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AllowAnonymous } from '@presentation/http/decorators/allow-anonymous.decorator';
import { CurrentUser } from '@presentation/http/decorators/current-user.decorator';
import { OAuth2StartResponseDto } from '@presentation/http/dto/oauth2-start.response.dto';

/** Only the redirect is needed here; typed rather than pulling in the platform. */
interface Redirectable {
  redirect(url: string): void;
}

/** Where a person is sent when a link cannot be finished, on the app's origin. */
const WENT_WRONG = '/?integration=failed';

@ApiTags('integrations')
@Controller()
export class OAuth2ConnectionController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('teams/:teamId/integrations/:source/connect')
  @ApiOperation({
    operationId: 'connectIntegration',
    summary: 'Begin linking this team to a host over OAuth2',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiParam({ name: 'source', example: 'slack' })
  @ApiOkResponse({ type: OAuth2StartResponseDto })
  @ApiUnauthorizedResponse({ description: 'No valid session' })
  @ApiNotFoundResponse({
    description:
      'No such team, not yours to link, or the host does not link so',
  })
  async connect(
    @Param('teamId') teamId: string,
    @Param('source') source: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OAuth2StartResponseDto> {
    const url = await this.commandBus.execute<
      BeginOAuth2ConnectionCommand,
      string | null
    >(new BeginOAuth2ConnectionCommand(teamId, source, user.id));

    if (!url) {
      throw new NotFoundException();
    }

    return new OAuth2StartResponseDto(url);
  }

  // No session: the host sends the person back, and the signed state is what
  // stands in for one. A fixed path, so it is the one URL the shared app is
  // registered to return to.
  @Get('integrations/oauth/callback')
  @AllowAnonymous()
  @ApiExcludeEndpoint()
  async callback(
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Res() response: Redirectable,
  ): Promise<void> {
    if (!state || !code) {
      response.redirect(WENT_WRONG);
      return;
    }

    const url = await this.commandBus.execute<
      FinishOAuth2ConnectionCommand,
      string | null
    >(new FinishOAuth2ConnectionCommand(state, code));

    response.redirect(url ?? WENT_WRONG);
  }
}
