import { ExchangeWorkloadTokenCommand } from '@identity/application/commands/exchange-workload-token.command';
import type { MintedTokenDto } from '@identity/application/dto/minted-token.dto';
import { ExchangeWorkloadTokenRequestDto } from '@identity/presentation/http/dto/exchange-workload-token.request.dto';
import { MintedTokenResponseDto } from '@identity/presentation/http/dto/minted-token.response.dto';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { CLIENT_HEADER } from '@platform/http/resources/resource-headers';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';

const UNAUTHORIZED =
  'Spotlight did not accept the exchange. Possible causes: an unknown trust, a token its issuer did not sign for the trust’s audience, a workload the trust does not admit, or a closed workspace';

@ApiTags('workspace-tokens')
@AllowAnonymous()
@Controller('workspace-tokens')
export class WorkloadTokenExchangeController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'exchangeWorkloadToken',
    summary:
      'Exchange the OIDC token a CI platform issued a workload for a short-lived workspace token, through a workspace token trust that admits it',
  })
  @ApiOkResponse({ type: MintedTokenResponseDto })
  @ApiUnauthorizedResponse({ description: UNAUTHORIZED })
  async exchange(
    @Body() body: ExchangeWorkloadTokenRequestDto,
    @Headers(CLIENT_HEADER) client: string | undefined,
  ): Promise<MintedTokenResponseDto> {
    const minted = await this.commandBus.execute<
      ExchangeWorkloadTokenCommand,
      MintedTokenDto | null
    >(
      new ExchangeWorkloadTokenCommand(
        typeof body?.trust === 'string' ? body.trust : '',
        typeof body?.token === 'string' ? body.token : '',
        Client.named(client),
      ),
    );

    if (!minted) {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    return new MintedTokenResponseDto(minted);
  }
}
