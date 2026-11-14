import { BeginOAuth2ConnectionCommand } from '@integrations/application/commands/begin-oauth2-connection.command';
import { FinishOAuth2ConnectionCommand } from '@integrations/application/commands/finish-oauth2-connection.command';
import type { OAuth2Start } from '@integrations/application/ports/oauth2-linking.port';
import { ACTS_AS } from '@integrations/domain/value-objects/acts-as.vo';
import { ConnectIntegrationRequestDto } from '@integrations/presentation/http/dto/connect-integration.request.dto';
import { OAuth2StartResponseDto } from '@integrations/presentation/http/dto/oauth2-start.response.dto';
import { OAUTH2_CALLBACK_ROUTE } from '@integrations/presentation/http/oauth2-callback-route';
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
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiExcludeEndpoint,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import {
  CurrentUser,
  OptionalUser,
} from '@platform/http/decorators/current-user.decorator';
import { RateLimited } from '@platform/http/decorators/rate-limited.decorator';
import type { RequestHeaders } from '@platform/http/request-headers';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

export interface Redirectable extends CookieJar {
  redirect(url: string): void;
}

export const FAILED_REDIRECT = '/?integration=failed';

const OAUTH2_ERROR_CODE = /^[a-z_]{1,64}$/;

type CallbackRefusal =
  | 'provider-error'
  | 'incomplete-callback'
  | 'no-nonce-cookie'
  | 'signed-out';

@ApiTags('integrations')
@Controller()
export class OAuth2ConnectionController {
  constructor(
    private readonly commandBus: CommandBus,
    @Inject(OAuth2NonceCookie) private readonly nonceCookie: OAuth2NonceCookie,
    @Inject(LOGGER) private readonly logger: LoggerPort,
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
  @ApiForbiddenResponse({
    description:
      'The caller is not a workspace admin, and asks for a team account',
  })
  @ApiNotFoundResponse({
    description:
      'The team is not found, the integration does not take this connection, or the integration has no OAuth2 client',
  })
  @ApiBadGatewayResponse({
    description:
      'The OAuth2 endpoints of the integration are not found, or its client registration failed',
  })
  async connect(
    @Param('teamId') teamId: string,
    @Param('integration') integration: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: CookieJar,
    @Body() body: ConnectIntegrationRequestDto = {},
  ): Promise<OAuth2StartResponseDto> {
    const actsAs = body?.actsAs ?? null;

    if (actsAs !== null && !ACTS_AS.includes(actsAs)) {
      throw new BadRequestException(
        `A connection must act as ${ACTS_AS.join(' or ')}. Received: ${actsAs}`,
      );
    }

    const started = await this.commandBus.execute<
      BeginOAuth2ConnectionCommand,
      OAuth2Start
    >(
      new BeginOAuth2ConnectionCommand(
        teamId,
        integration,
        user.id,
        actsAs,
        typeof body?.returnTo === 'string' ? body.returnTo : null,
      ),
    );

    this.nonceCookie.set(response, started.nonce, started.expiresAt);

    return new OAuth2StartResponseDto(started.url);
  }

  @Get(OAUTH2_CALLBACK_ROUTE)
  @AllowAnonymous({ readsSession: true })
  @RateLimited({ name: 'oauth2-callback', max: 30, windowSeconds: 60 })
  @ApiExcludeEndpoint()
  async callback(
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: { readonly headers: RequestHeaders },
    @Res() response: Redirectable,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<void> {
    const nonce = this.nonceCookie.readFrom(request.headers);
    this.nonceCookie.clear(response);

    if (error) {
      this.failed(response, 'provider-error', error);
      return;
    }

    if (!state || !code) {
      this.failed(response, 'incomplete-callback');
      return;
    }

    if (!nonce) {
      this.failed(response, 'no-nonce-cookie');
      return;
    }

    if (!viewer) {
      this.failed(response, 'signed-out');
      return;
    }

    const url = await this.commandBus.execute<
      FinishOAuth2ConnectionCommand,
      string | null
    >(new FinishOAuth2ConnectionCommand(state, code, nonce, viewer.id));

    response.redirect(url ?? FAILED_REDIRECT);
  }

  private failed(
    response: Redirectable,
    reason: CallbackRefusal,
    error?: string,
  ): void {
    this.logger.info(
      {
        reason,
        providerError:
          error && OAUTH2_ERROR_CODE.test(error) ? error : undefined,
      },
      'Did not finish an OAuth2 connection',
    );
    response.redirect(FAILED_REDIRECT);
  }
}
