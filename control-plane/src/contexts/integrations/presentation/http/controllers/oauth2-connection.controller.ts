import { BeginOAuth2ConnectionCommand } from '@integrations/application/commands/begin-oauth2-connection.command';
import { FinishOAuth2ConnectionCommand } from '@integrations/application/commands/finish-oauth2-connection.command';
import {
  OAUTH2_CALLBACK_ROUTE,
  type OAuth2Begun,
} from '@integrations/application/ports/oauth2-linking.port';
import {
  CONNECTING_FOR,
  ConnectIntegrationRequestDto,
} from '@integrations/presentation/http/dto/connect-integration.request.dto';
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

export const WENT_WRONG = '/?integration=failed';

@ApiTags('integrations')
@Controller()
export class OAuth2ConnectionController {
  constructor(
    private readonly commandBus: CommandBus,
    @Inject(SESSION_READER) private readonly sessions: SessionReaderPort,
    @Inject(OAuth2NonceCookie) private readonly nonceCookie: OAuth2NonceCookie,
  ) {}

  @Post('teams/:teamId/integrations/:source/connect')
  @ApiOperation({
    operationId: 'connectIntegration',
    summary: 'Begin connecting the team, or the caller, to a host over OAuth2',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiParam({ name: 'source', example: 'slack' })
  @ApiBody({ type: ConnectIntegrationRequestDto, required: false })
  @ApiOkResponse({ type: OAuth2StartResponseDto })
  @ApiBadRequestResponse({
    description: 'It asks to connect for someone other than the team or me',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session' })
  @ApiNotFoundResponse({
    description:
      'No such team, not yours to link, or the host does not link so',
  })
  async connect(
    @Param('teamId') teamId: string,
    @Param('source') source: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: CookieJar,
    @Body() body: ConnectIntegrationRequestDto = {},
  ): Promise<OAuth2StartResponseDto> {
    const connecting = body?.for ?? 'team';

    if (!CONNECTING_FOR.includes(connecting)) {
      throw new BadRequestException(
        `Connect for ${CONNECTING_FOR.join(' or ')}`,
      );
    }

    const begun = await this.commandBus.execute<
      BeginOAuth2ConnectionCommand,
      OAuth2Begun | null
    >(
      new BeginOAuth2ConnectionCommand(
        teamId,
        source,
        user.id,
        connecting === 'me' ? 'person' : 'team',
        typeof body?.back === 'string' ? body.back : null,
      ),
    );

    if (!begun) {
      throw new NotFoundException();
    }

    this.nonceCookie.set(response, begun.nonce, begun.expiresAt);

    return new OAuth2StartResponseDto(begun.url);
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
      response.redirect(WENT_WRONG);
      return;
    }

    const viewer = await this.sessions.read(request.headers);

    if (!viewer) {
      response.redirect(WENT_WRONG);
      return;
    }

    const url = await this.commandBus.execute<
      FinishOAuth2ConnectionCommand,
      string | null
    >(new FinishOAuth2ConnectionCommand(state, code, nonce, viewer.id));

    response.redirect(url ?? WENT_WRONG);
  }
}
