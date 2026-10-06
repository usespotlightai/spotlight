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
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { bearerIn } from '@platform/http/bearer';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { RedeemEgressCommand } from '@work/application/commands/egress.commands';
import type { EgressRedemptionDto } from '@work/application/dto/egress-redemption.dto';
import { RedeemEgressRequestDto } from '@work/presentation/http/dto/egress.request.dto';
import {
  EgressRedemptionResponseDto,
  ReadInNetworkResponseDto,
  RedeemedSecretResponseDto,
  WithheldSecretResponseDto,
} from '@work/presentation/http/dto/egress.response.dto';

const REFUSED =
  'Missing or unknown egress token, or its runner no longer holds work';

@ApiTags('runners')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: REFUSED })
@AllowAnonymous()
@Controller('egress')
export class EgressController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'redeemEgress',
    summary:
      'The secrets the run a sandbox holds may wear, for the egress beside it to inject toward their hosts',
    description:
      'Called by egress with the credential its host was handed for this run alone. Each call grants the secrets the run wears; values Spotlight keeps come back sealed to the recipient, and values read from an external store come back as where egress reads them.',
  })
  @ApiOkResponse({ type: EgressRedemptionResponseDto })
  @ApiUnprocessableEntityResponse({
    description: 'The recipient is not an X25519 public key',
  })
  async redeem(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: RedeemEgressRequestDto,
  ): Promise<EgressRedemptionResponseDto> {
    const redeemed = await this.commandBus.execute<
      RedeemEgressCommand,
      EgressRedemptionDto
    >(new RedeemEgressCommand(bearerIn(authorization), body?.recipient ?? ''));

    if (redeemed.outcome === 'refused') {
      throw new UnauthorizedException(REFUSED);
    }

    return new EgressRedemptionResponseDto(
      redeemed.runId,
      redeemed.reaches,
      redeemed.secrets.map(
        (each) =>
          new RedeemedSecretResponseDto(
            each.secret,
            each.host,
            each.carrier,
            each.name,
            each.prefix,
            each.sealed,
            each.readInNetwork
              ? new ReadInNetworkResponseDto(
                  each.readInNetwork.kind,
                  each.readInNetwork.secretId,
                  each.readInNetwork.field,
                )
              : null,
          ),
      ),
      redeemed.withheld.map(
        (each) => new WithheldSecretResponseDto(each.secret, each.reason),
      ),
    );
  }
}
