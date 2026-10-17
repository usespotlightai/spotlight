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
  AnswerHostCallCommand,
  ClaimHostCallCommand,
} from '@work/application/commands/host-call.commands';
import { ClaimHostWorkCommand } from '@work/application/commands/runner.commands';
import type { HostClaimDto } from '@work/application/dto/host.dto';
import type {
  HostCallAnswerDto,
  HostCallClaimDto,
} from '@work/application/dto/host-call.dto';
import type { HostRequirementsDto } from '@work/application/dto/host-requirements.dto';
import { HostRequirementsQuery } from '@work/application/queries/host.queries';
import { HostClaimResponseDto } from '@work/presentation/http/dto/host.response.dto';
import {
  AnswerHostCallRequestDto,
  ClaimHostCallRequestDto,
} from '@work/presentation/http/dto/host-call.request.dto';
import { HostCallResponseDto } from '@work/presentation/http/dto/host-call.response.dto';
import { ClaimHostWorkRequestDto } from '@work/presentation/http/dto/host-claim.request.dto';
import {
  HostRequirementsResponseDto,
  RunnerReleaseResponseDto,
} from '@work/presentation/http/dto/host-requirements.response.dto';
import { InstallableHarnessResponseDto } from '@work/presentation/http/dto/installable-harness.response.dto';
import { ClaimedWorkHttpMapper } from '@work/presentation/http/mappers/claimed-work.http.mapper';

interface Answerable {
  status(code: number): unknown;
}

const UNAUTHORIZED =
  'Missing, rotated or unknown pool token, or a workload the trust does not admit';

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
      new RunnerReleaseResponseDto(required.runnerMinimum),
      required.harnesses.map(
        (harness) =>
          new InstallableHarnessResponseDto(
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
      'Long-poll for one run or check, handed over with a one-run runner’s credential for a fresh sandbox',
    description:
      'Each claim starts a one-run runner through the pool or trust. The host passes its credential into the sandbox and never its own; the runner there carries it on every later call.',
  })
  @ApiOkResponse({ type: HostClaimResponseDto })
  @ApiConflictResponse({
    description:
      'The host has not reported through this pool or trust (`host-unreported`), or has not reported serving the image it claims for (`image-unreported`)',
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
      ),
    );

    if (claimed.outcome === 'unauthorized') {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    if (claimed.outcome === 'stranger') {
      throw new ConflictException({
        reason: 'host-unreported',
        message:
          'This host has not reported through this pool or trust. Please report presence first.',
      });
    }

    if (claimed.outcome === 'unoffered') {
      throw new ConflictException({
        reason: 'image-unreported',
        message:
          'This host has not reported that it serves that image. Please report presence with the image first.',
      });
    }

    if (claimed.outcome === 'nothing') {
      response.status(HttpStatus.NO_CONTENT);
      return undefined;
    }

    return new HostClaimResponseDto(
      claimed.runnerId,
      claimed.token,
      claimed.egressToken,
      ClaimedWorkHttpMapper.toResponse(claimed.work),
    );
  }

  @Post('calls/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'claimHostCall',
    summary:
      'Long-poll for one call a hook asked to be sent from inside the host’s network',
    description:
      'Hands over the oldest call waiting for this pool’s or trust’s workspace that has not lapsed. The host sends it once and answers with what came back.',
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

    if (claimed.outcome === 'stranger') {
      throw new ConflictException({
        reason: 'host-unreported',
        message:
          'This host has not reported through this pool or trust. Please report presence first.',
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

  @Post('calls/:id/answer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'answerHostCall',
    summary: 'Answer a claimed call with what came back when it was sent',
  })
  @ApiNoContentResponse({ description: 'The answer was taken' })
  @ApiNotFoundResponse({
    description: 'No such call waits for this pool’s or trust’s workspace',
  })
  @ApiConflictResponse({
    description:
      'The call was already answered, lapsed before it was answered, or was never claimed (`call-completed`), or another host claimed it (`not-this-hosts-call`)',
  })
  async answerCall(
    @Headers('authorization') authorization: string | undefined,
    @Headers(TRUST_HEADER) trust: string | undefined,
    @Param('id') id: string,
    @Body() body: AnswerHostCallRequestDto,
  ): Promise<void> {
    const answered = await this.commandBus.execute<
      AnswerHostCallCommand,
      HostCallAnswerDto
    >(
      new AnswerHostCallCommand(
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
