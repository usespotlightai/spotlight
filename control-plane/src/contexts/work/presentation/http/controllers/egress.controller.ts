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
  AuthorizeRunnerCommand,
  CheckActiveRunsCommand,
  FetchRunSecretsCommand,
  FetchSharedRunSecretsCommand,
  RecordEgressConnectionsCommand,
} from '@work/application/commands/egress.commands';
import type {
  EgressActiveRunsDto,
  EgressAuthorizationDto,
} from '@work/application/dto/egress-authorization.dto';
import type { EgressConnectionsRecordedDto } from '@work/application/dto/egress-connections.dto';
import type { EgressSecretsDto } from '@work/application/dto/egress-secrets.dto';
import {
  AuthorizeRunnerRequestDto,
  CheckActiveRunsRequestDto,
  FetchRunSecretsRequestDto,
  RecordEgressConnectionsRequestDto,
} from '@work/presentation/http/dto/egress.request.dto';
import {
  DeniedSecretResponseDto,
  EgressActiveRunsResponseDto,
  EgressAuthorizationResponseDto,
  EgressSecretsResponseDto,
  ExternalSecretRefResponseDto,
  FetchedSecretResponseDto,
  SpotlightApiResponseDto,
} from '@work/presentation/http/dto/egress.response.dto';

const UNAUTHORIZED =
  'Missing or unknown egress token, or its runner no longer has a lease on work';

const tooMany = (max: number, what: string): string =>
  `The request has more than ${max} ${what}. Please send at most ${max} in one request.`;

const WAITING =
  'The runner of this proxy credential has no lease on a run yet. Please fetch the secrets again after it claims one';

const texts = (value: unknown): readonly string[] =>
  Array.isArray(value)
    ? value.filter((each): each is string => typeof each === 'string')
    : [];

const records = (
  value: unknown,
): RecordEgressConnectionsRequestDto['records'] =>
  Array.isArray(value)
    ? value.filter(
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
@ApiUnauthorizedResponse({ description: UNAUTHORIZED })
@AllowAnonymous()
@Controller('egress')
export class EgressController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('secrets')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'fetchRunSecrets',
    summary:
      'The secrets that egress injects into the run’s requests, for their bound hosts',
    description:
      'Called by an egress sidecar with the credential its host was handed for this run alone, or by a shared egress with its egress token and the run proxy credential the runner presented. Each call grants the secrets that egress injects for the run. Values that Spotlight stores come back sealed to the recipient. For a value in an external store, the response gives the external reference that egress reads.',
  })
  @ApiOkResponse({ type: EgressSecretsResponseDto })
  @ApiUnprocessableEntityResponse({
    description: 'The recipient is not an X25519 public key',
  })
  @ApiConflictResponse({ description: WAITING })
  async fetchRunSecrets(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: FetchRunSecretsRequestDto,
  ): Promise<EgressSecretsResponseDto> {
    const token = bearerIn(authorization);
    const recipient = typeof body?.recipient === 'string' ? body.recipient : '';
    const fetched = await this.commandBus.execute<
      FetchRunSecretsCommand | FetchSharedRunSecretsCommand,
      EgressSecretsDto
    >(
      typeof body?.proxyCredential === 'string'
        ? new FetchSharedRunSecretsCommand(
            token,
            body.proxyCredential,
            recipient,
          )
        : new FetchRunSecretsCommand(token, recipient),
    );

    if (fetched.outcome === 'unauthorized') {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    if (fetched.outcome === 'waiting') {
      throw new ConflictException(WAITING);
    }

    return new EgressSecretsResponseDto(
      fetched.runId,
      fetched.extraAllowedHosts,
      fetched.bound,
      fetched.secrets.map(
        (each) =>
          new FetchedSecretResponseDto(
            each.secret,
            each.host,
            each.location,
            each.name,
            each.prefix,
            each.sealed,
            each.externalRef
              ? new ExternalSecretRefResponseDto(
                  each.externalRef.kind,
                  each.externalRef.secretId,
                  each.externalRef.field,
                )
              : null,
          ),
      ),
      fetched.denied.map(
        (each) => new DeniedSecretResponseDto(each.secret, each.reason),
      ),
      fetched.spotlightApi
        ? new SpotlightApiResponseDto(fetched.spotlightApi.sealed)
        : null,
    );
  }

  @Post('authorize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'authorizeRunner',
    summary:
      'Whether a shared egress may serve the runner that presented a run proxy credential',
    description:
      'Called by a shared egress with its egress token. Before the runner has a run, the egress allows it to connect only to the control plane.',
  })
  @ApiOkResponse({ type: EgressAuthorizationResponseDto })
  async authorize(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: AuthorizeRunnerRequestDto,
  ): Promise<EgressAuthorizationResponseDto> {
    const authorized = await this.commandBus.execute<
      AuthorizeRunnerCommand,
      EgressAuthorizationDto
    >(
      new AuthorizeRunnerCommand(
        bearerIn(authorization),
        typeof body?.proxyCredential === 'string' ? body.proxyCredential : '',
      ),
    );

    if (authorized.outcome === 'unauthorized') {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    return new EgressAuthorizationResponseDto(
      authorized.runnerId,
      authorized.workspaceId,
      authorized.controlPlaneHost,
      authorized.controlPlanePort,
      authorized.extraAllowedHosts,
    );
  }

  @Post('active-runs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'checkActiveRuns',
    summary: 'The runs of a shared egress that their runners still lease',
    description:
      'Called by each node of a shared egress about every 30 seconds. The node evicts the secrets of every run that is not in the response.',
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

    if (checked.outcome === 'unauthorized') {
      throw new UnauthorizedException(UNAUTHORIZED);
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
      'Called by a shared egress with its egress token. Spotlight stores each record with its run for 30 days. It stores a record only when the run still names the runner of the proxy credential, and that runner is active, or ended at most 2 minutes before.',
  })
  @ApiNoContentResponse({ description: 'Spotlight accepted the records' })
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

    if (recorded.outcome === 'unauthorized') {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    if (recorded.outcome === 'too-many') {
      throw new UnprocessableEntityException(tooMany(recorded.max, 'records'));
    }
  }
}
