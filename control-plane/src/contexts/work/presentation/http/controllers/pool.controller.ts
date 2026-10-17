import {
  Controller,
  Get,
  Headers,
  Param,
  UnauthorizedException,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { bearerIn } from '@platform/http/bearer';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import type { PoolQueueDto } from '@work/application/dto/pool.dto';
import { PoolQueueQuery } from '@work/application/queries/pool.queries';
import { PoolQueueResponseDto } from '@work/presentation/http/dto/pool.response.dto';

const UNAUTHORIZED = 'Missing, rotated or unknown pool token';

@ApiTags('runners')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: UNAUTHORIZED })
@AllowAnonymous()
@Controller('pools')
export class PoolController {
  constructor(private readonly queryBus: QueryBus) {}

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
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    return new PoolQueueResponseDto(
      queue.pending,
      queue.running,
      queue.capacity,
      queue.labels,
    );
  }
}
