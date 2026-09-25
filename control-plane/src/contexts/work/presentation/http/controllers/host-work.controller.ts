import {
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { bearerIn, TRUST_HEADER } from '@platform/http/bearer';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { ClaimHostWorkCommand } from '@work/application/commands/runner.commands';
import type { HostClaimDto } from '@work/application/dto/host.dto';
import type { HostRequirementsDto } from '@work/application/dto/host-requirements.dto';
import { HostRequirementsQuery } from '@work/application/queries/host.queries';
import { HostClaimResponseDto } from '@work/presentation/http/dto/host.response.dto';
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

const REFUSED =
  'Missing, rotated or unknown pool token, or a workload the trust does not admit';

@ApiTags('runners')
@ApiBearerAuth()
@ApiHeader({
  name: 'Spotlight-Trust',
  required: false,
  description:
    'The runner trust to claim through; the bearer is then the workload’s token',
})
@ApiUnauthorizedResponse({ description: REFUSED })
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
      throw new UnauthorizedException(REFUSED);
    }

    return new HostRequirementsResponseDto(
      new RunnerReleaseResponseDto(required.runnerAtLeast),
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

    if (claimed.outcome === 'refused') {
      throw new UnauthorizedException(REFUSED);
    }

    if (claimed.outcome === 'stranger') {
      throw new ConflictException({
        reason: 'host-unreported',
        message:
          'This host has not reported through this pool or trust; report presence first',
      });
    }

    if (claimed.outcome === 'unoffered') {
      throw new ConflictException({
        reason: 'image-unreported',
        message:
          'This host has not reported serving that image; report presence with it first',
      });
    }

    if (claimed.outcome === 'nothing') {
      response.status(HttpStatus.NO_CONTENT);
      return undefined;
    }

    return new HostClaimResponseDto(
      claimed.runnerId,
      claimed.token,
      ClaimedWorkHttpMapper.toResponse(claimed.work),
    );
  }
}
