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
import type { HarnessDto } from '@work/application/dto/harness.dto';
import type { HostClaimDto } from '@work/application/dto/host.dto';
import { HostHarnessesQuery } from '@work/application/queries/host.queries';
import { HostClaimResponseDto } from '@work/presentation/http/dto/host.response.dto';
import { ClaimHostWorkRequestDto } from '@work/presentation/http/dto/host-claim.request.dto';
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

  @Get('harnesses')
  @ApiOperation({
    operationId: 'hostHarnesses',
    summary:
      'What a host looks for in its runner images, so its claims can say what they hold',
  })
  @ApiOkResponse({ type: InstallableHarnessResponseDto, isArray: true })
  async harnesses(
    @Headers('authorization') authorization: string | undefined,
    @Headers(TRUST_HEADER) trust: string | undefined,
  ): Promise<InstallableHarnessResponseDto[]> {
    const harnesses = await this.queryBus.execute<
      HostHarnessesQuery,
      HarnessDto[] | null
    >(new HostHarnessesQuery({ bearer: bearerIn(authorization), trust }));

    if (!harnesses) {
      throw new UnauthorizedException(REFUSED);
    }

    return harnesses.map(
      (harness) =>
        new InstallableHarnessResponseDto(
          harness.id,
          harness.executable,
          harness.discovery,
          harness.versionProbe,
        ),
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
    description: 'The host has not reported through this pool or trust',
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
        (body?.harnesses ?? []).map((each) => ({
          id: each.id,
          models: each.models ?? [],
          ...(each.version ? { version: each.version } : {}),
        })),
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
