import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReadinessChecks } from '@platform/health/readiness-checks';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { HealthResponseDto } from '@platform/http/dto/health.response.dto';
import {
  ReadinessCheckDto,
  ReadinessResponseDto,
} from '@platform/http/dto/readiness.response.dto';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import type { Response } from 'express';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly readiness: ReadinessChecks,
    @Inject(LOGGER) private readonly logger: LoggerPort,
  ) {}

  @Get()
  @AllowAnonymous()
  @ApiOperation({ operationId: 'getHealth', summary: 'Liveness probe' })
  @ApiOkResponse({ type: HealthResponseDto })
  handle(): HealthResponseDto {
    return new HealthResponseDto();
  }

  @Get('ready')
  @AllowAnonymous()
  @ApiOperation({ operationId: 'getReadiness', summary: 'Readiness probe' })
  @ApiOkResponse({ type: ReadinessResponseDto })
  @ApiServiceUnavailableResponse({ type: ReadinessResponseDto })
  async ready(
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReadinessResponseDto> {
    const outcomes = await this.readiness.run();

    for (const outcome of outcomes) {
      if (!outcome.ok) {
        this.logger.warn(
          { err: outcome.error, check: outcome.name },
          'Readiness check failed',
        );
      }
    }

    const body = new ReadinessResponseDto(
      outcomes.map(
        (each) => new ReadinessCheckDto(each.name, each.ok ? 'ok' : 'failed'),
      ),
    );

    res.status(
      body.status === 'ready' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return body;
  }
}
