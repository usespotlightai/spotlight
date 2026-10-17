import { BeginOAuth2ConnectionCommand } from '@integrations/application/commands/begin-oauth2-connection.command';
import { FinishOAuth2ConnectionCommand } from '@integrations/application/commands/finish-oauth2-connection.command';
import {
  OAUTH2_CALLBACK_ROUTE,
  type OAuth2Start,
} from '@integrations/application/ports/oauth2-linking.port';
import { ACTS_AS } from '@integrations/domain/value-objects/acts-as.vo';
import { ConnectIntegrationRequestDto } from '@integrations/presentation/http/dto/connect-integration.request.dto';
import { OAuth2StartResponseDto } from '@integrations/presentation/http/dto/oauth2-start.response.dto';
import {
  type CookieJar,
  OAuth2NonceCookie,
} from '@integrations/presentation/http/oauth2-nonce-cookie';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiExcludeEndpoint,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import {
  type AuthenticatedUser,
  type RequestHeaders,
  SESSION_READER,
  type SessionReaderPort,
} from '@shared-kernel/application/ports/session.port';

export interface Redirectable extends CookieJar {
  redirect(url: string): void;
}

export const FAILED_REDIRECT = '/?integration=failed';

@ApiTags('integrations')
@Controller()
export class OAuth2ConnectionController {
  constructor(
    private readonly commandBus: CommandBus,
    @Inject(SESSION_READER) private readonly sessions: SessionReaderPort,
    @Inject(OAuth2NonceCookie) private readonly nonceCookie: OAuth2NonceCookie,
  ) {}

  @Post('teams/:teamId/integrations/:integration/connect')
  @ApiOperation({
    operationId: 'connectIntegration',
    summary:
      'Begin connecting the team, or the caller, to an integration over OAuth2',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiParam({ name: 'integration', example: 'slack' })
  @ApiBody({ type: ConnectIntegrationRequestDto, required: false })
  @ApiOkResponse({ type: OAuth2StartResponseDto })
  @ApiBadRequestResponse({
    description:
      'It requests a connection that acts as someone other than the team or the requester',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session' })
  @ApiNotFoundResponse({
    description:
      'No such team, not yours to connect, or the integration does not take this connection',
  })
  async connect(
    @Param('teamId') teamId: string,
    @Param('integration') integration: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: CookieJar,
    @Body() body: ConnectIntegrationRequestDto = {},
  ): Promise<OAuth2StartResponseDto> {
    const actsAs = body?.actsAs ?? 'team';

    if (!ACTS_AS.includes(actsAs)) {
      throw new BadRequestException(
        `A connection must act as ${ACTS_AS.join(' or ')}. Received: ${String(actsAs)}`,
      );
    }

    const started = await this.commandBus.execute<
      BeginOAuth2ConnectionCommand,
      OAuth2Start | null
    >(
      new BeginOAuth2ConnectionCommand(
        teamId,
        integration,
        user.id,
        actsAs === 'requester' ? 'person' : 'team',
        typeof body?.returnTo === 'string' ? body.returnTo : null,
      ),
    );

    if (!started) {
      throw new NotFoundException();
    }

    this.nonceCookie.set(response, started.nonce, started.expiresAt);

    return new OAuth2StartResponseDto(started.url);
  }

  @Get(OAUTH2_CALLBACK_ROUTE)
  @AllowAnonymous()
  @ApiExcludeEndpoint()
  async callback(
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Req() request: { readonly headers: RequestHeaders },
    @Res() response: Redirectable,
  ): Promise<void> {
    const nonce = this.nonceCookie.readFrom(request.headers);
    this.nonceCookie.clear(response);

    if (!state || !code || !nonce) {
      response.redirect(FAILED_REDIRECT);
      return;
    }

    const viewer = await this.sessions.read(request.headers);

    if (!viewer) {
      response.redirect(FAILED_REDIRECT);
      return;
    }

    const url = await this.commandBus.execute<
      FinishOAuth2ConnectionCommand,
      string | null
    >(new FinishOAuth2ConnectionCommand(state, code, nonce, viewer.id));

    response.redirect(url ?? FAILED_REDIRECT);
  }
}
