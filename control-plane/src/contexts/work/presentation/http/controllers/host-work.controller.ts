import {
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { bearerIn, TRUST_HEADER } from '@platform/http/bearer';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import {
  ClaimHostCallCommand,
  RecordHostCallResponseCommand,
} from '@work/application/commands/host-call.commands';
import { ClaimHostWorkCommand } from '@work/application/commands/runner.commands';
import type { HostClaimDto } from '@work/application/dto/host.dto';
import type {
  HostCallClaimDto,
  RecordHostCallResponseDto,
} from '@work/application/dto/host-call.dto';
import type { HostRequirementsDto } from '@work/application/dto/host-requirements.dto';
import { HostRequirementsQuery } from '@work/application/queries/host.queries';
import { HarnessProbeResponseDto } from '@work/presentation/http/dto/harness-probe.response.dto';
import { HostClaimResponseDto } from '@work/presentation/http/dto/host.response.dto';
import {
  ClaimHostCallRequestDto,
  RecordHostCallResponseRequestDto,
} from '@work/presentation/http/dto/host-call.request.dto';
import { HostCallResponseDto } from '@work/presentation/http/dto/host-call.response.dto';
import { ClaimHostWorkRequestDto } from '@work/presentation/http/dto/host-claim.request.dto';
import {
  HostReleaseResponseDto,
  HostRequirementsResponseDto,
  RunnerReleaseResponseDto,
} from '@work/presentation/http/dto/host-requirements.response.dto';
import { ClaimedWorkResponseDto } from '@work/presentation/http/dto/runner.response.dto';
import { ClaimedWorkHttpMapper } from '@work/presentation/http/mappers/claimed-work.http.mapper';

interface Answerable {
  status(code: number): unknown;
}

const UNAUTHORIZED =
  'Missing, rotated or unknown pool token, or a workload the trust does not match';

@ApiTags('runners')
@ApiBearerAuth()
@ApiHeader({
  name: 'Spotlight-Trust',
  required: false,
  description:
    'The runner trust to claim through; the bearer is then the workload’s token',
})
@ApiUnauthorizedResponse({ description: UNAUTHORIZED })
@AllowAnonymous()
@Controller('hosts')
export class HostWorkController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('requirements')
  @ApiOperation({
    operationId: 'hostRequirements',
    summary:
      'Which runner images a host should serve, what to look for in them, and how new their runner must be',
  })
  @ApiOkResponse({ type: HostRequirementsResponseDto })
  async requirements(
    @Headers('authorization') authorization: string | undefined,
    @Headers(TRUST_HEADER) trust: string | undefined,
  ): Promise<HostRequirementsResponseDto> {
    const required = await this.queryBus.execute<
      HostRequirementsQuery,
      HostRequirementsDto | null
    >(new HostRequirementsQuery({ bearer: bearerIn(authorization), trust }));

    if (!required) {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    return new HostRequirementsResponseDto(
      new HostReleaseResponseDto(required.hostRelease, required.hostMinimum),
      new RunnerReleaseResponseDto(required.runnerMinimum),
      required.harnesses.map(
        (harness) =>
          new HarnessProbeResponseDto(
            harness.id,
            harness.executable,
            harness.discovery,
            harness.versionProbe,
          ),
      ),
      required.images,
    );
  }

  @Post('claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'claimHostWork',
    summary:
      'Long-poll for one run or check, assigned with a one-run runner’s credential, or for a sandbox to start with no run',
    description:
      'Each claim starts a one-run runner through the pool or trust. The host passes its credential into the sandbox and never its own; the runner there carries it on every later call. A run of a task or chat whose workspace a ready sandbox keeps goes only to that sandbox: its host claims it with `sandbox`, and the run reuses the sandbox. Other runs start a new sandbox. When no run waits, the claim can start a requested sandbox with no run (`work.kind` is `sandbox`): it restores the workspace of its task or chat and waits for runs.',
  })
  @ApiOkResponse({ type: HostClaimResponseDto })
  @ApiConflictResponse({
    description:
      'The host has not reported through this pool or trust (`host-unreported`), is on a release older than the host minimum (`host-outdated`), or has not reported that it supports the image it claims for (`image-unreported`)',
  })
  @ApiNoContentResponse({
    description:
      'Nothing waits for this pool or trust yet, or the pool is at maxRuns',
  })
  async claim(
    @Headers('authorization') authorization: string | undefined,
    @Headers(TRUST_HEADER) trust: string | undefined,
    @Body() body: ClaimHostWorkRequestDto,
    @Res({ passthrough: true }) response: Answerable,
  ): Promise<HostClaimResponseDto | undefined> {
    const claimed = await this.commandBus.execute<
      ClaimHostWorkCommand,
      HostClaimDto
    >(
      new ClaimHostWorkCommand(
        { bearer: bearerIn(authorization), trust },
        body?.host ?? '',
        body?.image ?? '',
        body?.sandbox || null,
      ),
    );

    if (claimed.outcome === 'unauthorized') {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    if (claimed.outcome === 'host-unreported') {
      throw new ConflictException({
        reason: 'host-unreported',
        message:
          'This host has not reported through this pool or trust. Please send a heartbeat first.',
      });
    }

    if (claimed.outcome === 'host-outdated') {
      throw new ConflictException({
        reason: 'host-outdated',
        message: `This host is on release ${claimed.release}. Minimum release required: ${claimed.minimum}. Update it with: spotlight host update`,
      });
    }

    if (claimed.outcome === 'image-unreported') {
      throw new ConflictException({
        reason: 'image-unreported',
        message:
          'This host has not reported that it supports that image. Please send a heartbeat that reports the image first.',
      });
    }

    if (claimed.outcome === 'nothing') {
      response.status(HttpStatus.NO_CONTENT);
      return undefined;
    }

    if (claimed.outcome === 'sandbox') {
      return new HostClaimResponseDto({
        runnerId: null,
        token: null,
        egressToken: null,
        sandboxId: claimed.sandboxId,
        sandboxToken: claimed.sandboxToken,
        allowedHosts: claimed.allowedHosts,
        reused: false,
        work: new ClaimedWorkResponseDto('sandbox', null, null),
      });
    }

    return new HostClaimResponseDto({
      runnerId: claimed.runnerId,
      token: claimed.token,
      egressToken: claimed.egressToken,
      sandboxId: claimed.sandboxId,
      sandboxToken: claimed.sandboxToken,
      allowedHosts: [],
      reused: claimed.reused,
      work: ClaimedWorkHttpMapper.toResponse(claimed.work),
    });
  }

  @Post('calls/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'claimHostCall',
    summary:
      'Long-poll for one call that a hook requested, to send from inside the host’s network',
    description:
      'Assigns the oldest call waiting for this pool’s or trust’s workspace that has not expired. The host sends it once and records the response.',
  })
  @ApiOkResponse({ type: HostCallResponseDto })
  @ApiNoContentResponse({
    description: 'No call waits for this pool’s or trust’s workspace',
  })
  @ApiConflictResponse({
    description:
      'The host has not reported through this pool or trust (`host-unreported`)',
  })
  async claimCall(
    @Headers('authorization') authorization: string | undefined,
    @Headers(TRUST_HEADER) trust: string | undefined,
    @Body() body: ClaimHostCallRequestDto,
    @Res({ passthrough: true }) response: Answerable,
  ): Promise<HostCallResponseDto | undefined> {
    const claimed = await this.commandBus.execute<
      ClaimHostCallCommand,
      HostCallClaimDto
    >(
      new ClaimHostCallCommand(
        { bearer: bearerIn(authorization), trust },
        body?.host ?? '',
      ),
    );

    if (claimed.outcome === 'unauthorized') {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    if (claimed.outcome === 'host-unreported') {
      throw new ConflictException({
        reason: 'host-unreported',
        message:
          'This host has not reported through this pool or trust. Please send a heartbeat first.',
      });
    }

    if (claimed.outcome === 'nothing') {
      response.status(HttpStatus.NO_CONTENT);
      return undefined;
    }

    const { call } = claimed;

    return new HostCallResponseDto(
      call.id,
      call.method,
      call.url,
      call.headers,
      call.body,
      call.timeoutMs,
    );
  }

  @Post('calls/:id/response')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'recordHostCallResponse',
    summary: 'Record the response to a claimed call',
  })
  @ApiNoContentResponse({ description: 'Spotlight recorded the response' })
  @ApiNotFoundResponse({
    description: 'No such call waits for this pool’s or trust’s workspace',
  })
  @ApiConflictResponse({
    description:
      'The call already has a response, expired before it got a response, or was never claimed (`call-completed`), or another host claimed it (`not-this-hosts-call`)',
  })
  async recordResponse(
    @Headers('authorization') authorization: string | undefined,
    @Headers(TRUST_HEADER) trust: string | undefined,
    @Param('id') id: string,
    @Body() body: RecordHostCallResponseRequestDto,
  ): Promise<void> {
    const answered = await this.commandBus.execute<
      RecordHostCallResponseCommand,
      RecordHostCallResponseDto
    >(
      new RecordHostCallResponseCommand(
        { bearer: bearerIn(authorization), trust },
        id,
        {
          host: body?.host,
          status: body?.status,
          headers: body?.headers,
          body: body?.body,
          ms: body?.ms,
          error: body?.error,
        },
      ),
    );

    if (answered.outcome === 'unauthorized') {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    if (answered.outcome === 'unknown') {
      throw new NotFoundException(
        `Network call ${id} does not exist for this host.`,
      );
    }

    if (answered.outcome === 'not-theirs') {
      throw new ConflictException({
        reason: 'not-this-hosts-call',
        message: `Another host claimed network call ${id}.`,
      });
    }

    if (answered.outcome === 'completed') {
      throw new ConflictException({
        reason: 'call-completed',
        message: answered.reason,
      });
    }
  }
}
