import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { bearerIn } from '@platform/http/bearer';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { ClaimPoolWorkCommand } from '@work/application/commands/runner.commands';
import type { HarnessDto } from '@work/application/dto/harness.dto';
import type {
  PoolClaimDto,
  PoolQueueDto,
} from '@work/application/dto/pool.dto';
import {
  PoolHarnessesQuery,
  PoolQueueQuery,
} from '@work/application/queries/pool.queries';
import { InstallableHarnessResponseDto } from '@work/presentation/http/dto/installable-harness.response.dto';
import { ClaimPoolWorkRequestDto } from '@work/presentation/http/dto/pool.request.dto';
import {
  PoolClaimResponseDto,
  PoolQueueResponseDto,
} from '@work/presentation/http/dto/pool.response.dto';
import { ClaimedWorkHttpMapper } from '@work/presentation/http/mappers/claimed-work.http.mapper';

interface Answerable {
  status(code: number): unknown;
}

const REFUSED = 'Missing, rotated or unknown pool token';

@ApiTags('runners')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: REFUSED })
@AllowAnonymous()
@Controller('pools')
export class PoolController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('harnesses')
  @ApiOperation({
    operationId: 'poolHarnesses',
    summary: 'What a pool’s runner looks for, so its claim can say what it has',
  })
  @ApiOkResponse({ type: InstallableHarnessResponseDto, isArray: true })
  async harnesses(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<InstallableHarnessResponseDto[]> {
    const harnesses = await this.queryBus.execute<
      PoolHarnessesQuery,
      HarnessDto[] | null
    >(new PoolHarnessesQuery(bearerIn(authorization)));

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
    operationId: 'claimPoolWork',
    summary:
      'Long-poll with the pool token for one run or check, swapped for a credential good for that work alone',
    description:
      'The pool token may only claim. A claim starts a one-run runner and answers its credential, which every later call carries; the pool token is never needed again for that work.',
  })
  @ApiOkResponse({ type: PoolClaimResponseDto })
  @ApiNoContentResponse({
    description: 'Nothing for this pool yet, or it is at maxRuns',
  })
  async claim(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ClaimPoolWorkRequestDto,
    @Res({ passthrough: true }) response: Answerable,
  ): Promise<PoolClaimResponseDto | undefined> {
    const claimed = await this.commandBus.execute<
      ClaimPoolWorkCommand,
      PoolClaimDto
    >(
      new ClaimPoolWorkCommand(
        bearerIn(authorization),
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

    if (claimed.outcome === 'nothing') {
      response.status(HttpStatus.NO_CONTENT);
      return undefined;
    }

    return new PoolClaimResponseDto(
      claimed.runnerId,
      claimed.token,
      ClaimedWorkHttpMapper.toResponse(claimed.work),
    );
  }

  @Get(':id/queue')
  @ApiOperation({
    operationId: 'poolQueue',
    summary:
      'How many runs wait for this pool, per label, for an autoscaler such as a KEDA ScaledJob',
  })
  @ApiParam({ name: 'id', example: '3f7c2a9e-1b64-4d8f-a5e0-9c2b7d4e1f86' })
  @ApiOkResponse({ type: PoolQueueResponseDto })
  async queue(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<PoolQueueResponseDto> {
    const queue = await this.queryBus.execute<
      PoolQueueQuery,
      PoolQueueDto | null
    >(new PoolQueueQuery(bearerIn(authorization), id));

    if (!queue) {
      throw new UnauthorizedException(REFUSED);
    }

    return new PoolQueueResponseDto(
      queue.pending,
      queue.running,
      queue.capacity,
      queue.labels,
    );
  }
}
