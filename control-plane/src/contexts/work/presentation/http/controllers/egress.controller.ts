import {
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { bearerIn } from '@platform/http/bearer';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import {
  AdmitThroughEgressCommand,
  CheckActiveRunsCommand,
  RecordEgressConnectionsCommand,
  RedeemEgressCommand,
  RedeemThroughEgressCommand,
} from '@work/application/commands/egress.commands';
import type {
  EgressActiveRunsDto,
  EgressAdmissionDto,
} from '@work/application/dto/egress-admission.dto';
import type { EgressConnectionsRecordedDto } from '@work/application/dto/egress-connections.dto';
import type { EgressRedemptionDto } from '@work/application/dto/egress-redemption.dto';
import {
  AdmitThroughEgressRequestDto,
  CheckActiveRunsRequestDto,
  RecordEgressConnectionsRequestDto,
  SharedRedeemEgressRequestDto,
} from '@work/presentation/http/dto/egress.request.dto';
import {
  EgressActiveRunsResponseDto,
  EgressAdmissionResponseDto,
  EgressRedemptionResponseDto,
  ReadInNetworkResponseDto,
  RedeemedSecretResponseDto,
  SpotlightApiResponseDto,
  WithheldSecretResponseDto,
} from '@work/presentation/http/dto/egress.response.dto';

const REFUSED =
  'Missing or unknown egress token, or its runner no longer has a lease on work';

const tooMany = (max: number, what: string): string =>
  `The request has more than ${max} ${what}. Please send at most ${max} in one request.`;

const WAITING =
  'The runner of this proxy credential has no lease on a run yet. Please redeem again after it claims one';

const texts = (given: unknown): readonly string[] =>
  Array.isArray(given)
    ? given.filter((each): each is string => typeof each === 'string')
    : [];

const records = (
  given: unknown,
): RecordEgressConnectionsRequestDto['records'] =>
  Array.isArray(given)
    ? given.filter(
        (each): each is RecordEgressConnectionsRequestDto['records'][number] =>
          typeof each === 'object' &&
          each !== null &&
          typeof each.proxyCredential === 'string' &&
          typeof each.host === 'string' &&
          typeof each.port === 'number' &&
          typeof each.bytesOut === 'number' &&
          typeof each.bytesIn === 'number' &&
          typeof each.ms === 'number' &&
          typeof each.outcome === 'string' &&
          (each.status === undefined || typeof each.status === 'number') &&
          (each.reason === undefined || typeof each.reason === 'string') &&
          typeof each.at === 'string',
      )
    : [];

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
      'The secrets that the run in a sandbox may wear, for the egress beside it to inject toward their hosts',
    description:
      'Called by the egress beside a sandbox with the credential its host was handed for this run alone, or by a shared egress with its egress token and the run proxy credential the runner presented. Each call grants the secrets the run wears; values Spotlight keeps come back sealed to the recipient, and values read from an external store come back as where egress reads them.',
  })
  @ApiOkResponse({ type: EgressRedemptionResponseDto })
  @ApiUnprocessableEntityResponse({
    description: 'The recipient is not an X25519 public key',
  })
  @ApiConflictResponse({ description: WAITING })
  async redeem(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: SharedRedeemEgressRequestDto,
  ): Promise<EgressRedemptionResponseDto> {
    const token = bearerIn(authorization);
    const recipient = typeof body?.recipient === 'string' ? body.recipient : '';
    const redeemed = await this.commandBus.execute<
      RedeemEgressCommand | RedeemThroughEgressCommand,
      EgressRedemptionDto
    >(
      typeof body?.proxyCredential === 'string'
        ? new RedeemThroughEgressCommand(token, body.proxyCredential, recipient)
        : new RedeemEgressCommand(token, recipient),
    );

    if (redeemed.outcome === 'refused') {
      throw new UnauthorizedException(REFUSED);
    }

    if (redeemed.outcome === 'waiting') {
      throw new ConflictException(WAITING);
    }

    return new EgressRedemptionResponseDto(
      redeemed.runId,
      redeemed.reaches,
      redeemed.bound,
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
      redeemed.spotlightApi
        ? new SpotlightApiResponseDto(redeemed.spotlightApi.sealed)
        : null,
    );
  }

  @Post('admit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'admitThroughEgress',
    summary:
      'Whether a shared egress may serve the runner that presented a run proxy credential',
    description:
      'Called by a shared egress with its egress token. Before the runner has a run, the egress lets it reach only the control plane.',
  })
  @ApiOkResponse({ type: EgressAdmissionResponseDto })
  async admit(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: AdmitThroughEgressRequestDto,
  ): Promise<EgressAdmissionResponseDto> {
    const admitted = await this.commandBus.execute<
      AdmitThroughEgressCommand,
      EgressAdmissionDto
    >(
      new AdmitThroughEgressCommand(
        bearerIn(authorization),
        typeof body?.proxyCredential === 'string' ? body.proxyCredential : '',
      ),
    );

    if (admitted.outcome === 'refused') {
      throw new UnauthorizedException(REFUSED);
    }

    return new EgressAdmissionResponseDto(
      admitted.runnerId,
      admitted.workspaceId,
      admitted.controlPlaneHost,
      admitted.controlPlanePort,
      admitted.reaches,
    );
  }

  @Post('active-runs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'checkActiveRuns',
    summary: 'The runs of a shared egress that their runners still lease',
    description:
      'Called by each node of a shared egress about every 30 seconds. The node forgets the secrets of every run that is not in the answer.',
  })
  @ApiOkResponse({ type: EgressActiveRunsResponseDto })
  @ApiUnprocessableEntityResponse({
    description: 'The request has more than 500 proxy credentials',
  })
  async checkActiveRuns(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CheckActiveRunsRequestDto,
  ): Promise<EgressActiveRunsResponseDto> {
    const checked = await this.commandBus.execute<
      CheckActiveRunsCommand,
      EgressActiveRunsDto
    >(
      new CheckActiveRunsCommand(
        bearerIn(authorization),
        texts(body?.proxyCredentials),
      ),
    );

    if (checked.outcome === 'refused') {
      throw new UnauthorizedException(REFUSED);
    }

    if (checked.outcome === 'too-many') {
      throw new UnprocessableEntityException(
        tooMany(checked.max, 'proxy credentials'),
      );
    }

    return new EgressActiveRunsResponseDto(checked.active);
  }

  @Post('connections')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'recordEgressConnections',
    summary: 'Records the connections a shared egress made for its runs',
    description:
      'Called by a shared egress with its egress token. Spotlight keeps each record with its run for 30 days. It keeps a record only when the run still names the runner of the proxy credential, and that runner is active, or ended at most 2 minutes before.',
  })
  @ApiNoContentResponse({ description: 'The records were taken' })
  @ApiUnprocessableEntityResponse({
    description: 'The request has more than 2000 records',
  })
  async connections(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: RecordEgressConnectionsRequestDto,
  ): Promise<void> {
    const recorded = await this.commandBus.execute<
      RecordEgressConnectionsCommand,
      EgressConnectionsRecordedDto
    >(
      new RecordEgressConnectionsCommand(
        bearerIn(authorization),
        records(body?.records),
      ),
    );

    if (recorded.outcome === 'refused') {
      throw new UnauthorizedException(REFUSED);
    }

    if (recorded.outcome === 'too-many') {
      throw new UnprocessableEntityException(tooMany(recorded.max, 'records'));
    }
  }
}
