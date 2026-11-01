import {
  Body,
  ConflictException,
  Controller,
  GoneException,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiConflictResponse,
  ApiGoneResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { RedeemCallSecretsCommand } from '@work/application/commands/host-call.commands';
import type { RedeemCallSecretsDto } from '@work/application/dto/host-call.dto';
import { EgressSecretsResponseDto } from '@work/presentation/http/dto/egress.response.dto';
import { RedeemCallSecretsRequestDto } from '@work/presentation/http/dto/host-call.request.dto';
import { EgressSecretsHttpMapper } from '@work/presentation/http/mappers/egress-secrets.http.mapper';

const WRONG_SECRETS_TOKEN =
  'The token does not redeem the secrets of this call, or there is no such call. Use the secretsToken that the claim gave';

@ApiTags('runners')
@AllowAnonymous()
@Controller('hosts')
export class HostCallSecretsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('calls/:id/secrets')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'redeemCallSecrets',
    summary:
      'The secrets of a claimed call, sealed to the egress that sends it',
    description:
      'Called by the egress that sends the call, with the secretsToken that the claim gave and no other credential. The token redeems the secrets once, while the host that claimed the call has it. Values that Spotlight stores come back sealed to the recipient for this call alone. For a value in an external store, the response gives the external reference that egress reads.',
  })
  @ApiOkResponse({ type: EgressSecretsResponseDto })
  @ApiUnauthorizedResponse({ description: WRONG_SECRETS_TOKEN })
  @ApiConflictResponse({
    description:
      'The secrets were redeemed already, another host claimed the call, or the call has a response',
  })
  @ApiGoneResponse({
    description: 'The call expired, or Spotlight stopped waiting for it',
  })
  @ApiUnprocessableEntityResponse({
    description: 'The recipient is not an X25519 public key',
  })
  async redeemSecrets(
    @Param('id') id: string,
    @Body() body: RedeemCallSecretsRequestDto,
  ): Promise<EgressSecretsResponseDto> {
    const redeemed = await this.commandBus.execute<
      RedeemCallSecretsCommand,
      RedeemCallSecretsDto
    >(
      new RedeemCallSecretsCommand(
        id,
        body?.host,
        body?.token,
        body?.recipient,
      ),
    );

    if (redeemed.outcome === 'unauthorized') {
      throw new UnauthorizedException(WRONG_SECRETS_TOKEN);
    }

    if (redeemed.outcome === 'taken') {
      throw new ConflictException({
        reason: 'call-secrets-taken',
        message: redeemed.reason,
      });
    }

    if (redeemed.outcome === 'expired') {
      throw new GoneException(redeemed.reason);
    }

    return EgressSecretsHttpMapper.toResponse(redeemed);
  }
}
